import { logger } from '@/lib/logger';

/**
 * Cache abstraction with graceful degradation.
 *
 * If Upstash Redis credentials (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * are configured, they would be used. Since credentials are pending, this module
 * transparently falls back to an in-memory store with TTL + a naive in-process
 * pub/sub. The public API is identical so swapping in real Redis later requires
 * no call-site changes.
 */

interface CacheEntry {
  value: string;
  expiresAt: number | null;
}

type Subscriber = (message: string) => void;

class MemoryCache {
  private store = new Map<string, CacheEntry>();
  private channels = new Map<string, Set<Subscriber>>();

  private isExpired(entry: CacheEntry): boolean {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delPattern(prefix: string): Promise<void> {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** Sliding window counter increment; returns current count. */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const existing = await this.get(key);
    const count = (existing ? parseInt(existing, 10) : 0) + 1;
    // Preserve original expiry window on first hit
    const entry = this.store.get(key);
    const expiresAt = entry && !this.isExpired(entry) ? entry.expiresAt : Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value: String(count), expiresAt });
    return count;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async publish(channel: string, message: string): Promise<void> {
    const subs = this.channels.get(channel);
    if (!subs) return;
    for (const sub of Array.from(subs)) {
      try {
        sub(message);
      } catch (err) {
        logger.error('Pub/sub subscriber error', { channel, error: String(err) });
      }
    }
  }

  subscribe(channel: string, subscriber: Subscriber): () => void {
    if (!this.channels.has(channel)) this.channels.set(channel, new Set());
    this.channels.get(channel)!.add(subscriber);
    return () => this.channels.get(channel)?.delete(subscriber);
  }

  isReal(): boolean {
    return false;
  }
}

const globalForCache = globalThis as unknown as { __cache?: MemoryCache };

export const cache: MemoryCache = globalForCache.__cache ?? new MemoryCache();
if (!globalForCache.__cache) globalForCache.__cache = cache;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** JSON-aware helpers */
export async function cacheGetJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await cache.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  try {
    await cache.set(key, JSON.stringify(value ?? null), ttlSeconds);
  } catch (err) {
    logger.warn('cacheSetJson failed', { key, error: String(err) });
  }
}
