import { cache } from '@/lib/cache/redis';
import { logger } from '@/lib/logger';

/**
 * Sliding-window rate limiter backed by the cache abstraction.
 * Fails OPEN (allows request) if the cache is unavailable — availability over
 * strict enforcement for a foundation build.
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch seconds
  retryAfter?: number;
}

export const RATE_LIMITS = {
  ipUnauth: { limit: 60, window: 60 },
  userAuth: { limit: 120, window: 60 },
  tenant: { limit: 1000, window: 60 },
  auth: { limit: 10, window: 60 },
  upload: { limit: 20, window: 60 },
} as const;

export type RateLimitScope = keyof typeof RATE_LIMITS;

export async function rateLimit(
  scope: RateLimitScope,
  identifier: string
): Promise<RateLimitResult> {
  const { limit, window } = RATE_LIMITS[scope];
  const key = `ratelimit:${scope}:${identifier}`;
  try {
    const count = await cache.incrWithTtl(key, window);
    const ttl = await cache.ttl(key);
    const reset = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : window);
    const remaining = Math.max(0, limit - count);
    if (count > limit) {
      return { allowed: false, limit, remaining: 0, reset, retryAfter: ttl > 0 ? ttl : window };
    }
    return { allowed: true, limit, remaining, reset };
  } catch (err) {
    logger.warn('rateLimit error — failing open', { scope, error: String(err) });
    return { allowed: true, limit, remaining: limit, reset: Math.floor(Date.now() / 1000) + window };
  }
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };
  if (result.retryAfter !== undefined) headers['Retry-After'] = String(result.retryAfter);
  return headers;
}
