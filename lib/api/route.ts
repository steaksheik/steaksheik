import { NextRequest, NextResponse } from 'next/server';
import { handleError, requestId } from '@/lib/api/response';
import { rateLimit, rateLimitHeaders, RateLimitScope } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/auth/context';
import { Errors } from '@/lib/api/errors';

/**
 * Wraps an API route handler with:
 *  - request-id generation
 *  - centralised error handling (no internal leakage)
 *  - optional rate limiting
 */
export interface RouteOptions {
  rateLimit?: RateLimitScope;
}

type Handler = (
  req: NextRequest,
  ctx: { params?: Record<string, string | string[]>; requestId: string }
) => Promise<NextResponse> | NextResponse;

export function withRoute(handler: Handler, options: RouteOptions = {}) {
  return async (
    req: NextRequest,
    routeCtx?: { params?: Record<string, string | string[]> }
  ): Promise<NextResponse> => {
    const rid = requestId();
    try {
      if (options.rateLimit) {
        const id = getClientIp(req) ?? 'anonymous';
        const result = await rateLimit(options.rateLimit, id);
        if (!result.allowed) {
          const res = handleError(Errors.rateLimited(), rid);
          for (const [k, v] of Object.entries(rateLimitHeaders(result))) res.headers.set(k, v);
          return res;
        }
      }
      return await handler(req, { params: routeCtx?.params, requestId: rid });
    } catch (err) {
      return handleError(err, rid);
    }
  };
}
