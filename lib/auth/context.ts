import { NextRequest } from 'next/server';
import { getSession, SessionData } from '@/lib/auth/session';
import { hasAllPermissions } from '@/lib/auth/rbac';
import { resolveTenantId } from '@/lib/tenant';
import { Errors } from '@/lib/api/errors';
import { SESSION_COOKIE } from '@/lib/constants';
import { verifyCsrf } from '@/lib/security/csrf';

export interface AuthContext {
  session: SessionData;
  tenantId: string;
  ip: string | null;
  userAgent: string | null;
}

export function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

/** Extract session from cookie or Authorization: Bearer <token>. */
async function extractSession(req: NextRequest): Promise<SessionData | null> {
  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return getSession(cookieToken ?? bearer);
}

/**
 * Require an authenticated session. Throws ApiError on failure.
 * Enforces CSRF on mutating requests (cookie-based sessions only).
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const session = await extractSession(req);
  if (!session) throw Errors.unauthorized();

  // CSRF only enforced when using cookie auth (not bearer API clients)
  const usingCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (usingCookie && !verifyCsrf(req)) {
    throw Errors.forbidden('CSRF token missing or invalid');
  }

  return {
    session,
    tenantId: session.tenantId,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  };
}

/** Require auth + all listed permissions. */
export async function requirePermission(
  req: NextRequest,
  ...permissions: string[]
): Promise<AuthContext> {
  const ctx = await requireAuth(req);
  if (!hasAllPermissions(ctx.session.permissions, permissions)) {
    throw Errors.forbidden(`Missing required permission(s): ${permissions.join(', ')}`);
  }
  return ctx;
}

/** Optional auth — returns context or null (for public endpoints needing tenant). */
export async function optionalAuth(req: NextRequest): Promise<AuthContext | null> {
  const session = await extractSession(req);
  if (!session) return null;
  return {
    session,
    tenantId: session.tenantId,
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  };
}

/** Resolve tenant for public (unauthenticated) endpoints. */
export async function publicTenant(req: NextRequest): Promise<string> {
  const tenantId = await resolveTenantId(req);
  if (!tenantId) throw Errors.notFound('Tenant not found');
  return tenantId;
}
