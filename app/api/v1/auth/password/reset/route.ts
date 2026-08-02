import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { createSession, destroyAllUserSessions } from '@/lib/auth/session';
import { getClientIp } from '@/lib/auth/context';
import { auditLog } from '@/lib/audit/service';
import { generateCsrfToken } from '@/lib/security/csrf';
import { SESSION_COOKIE, CSRF_COOKIE, SESSION_TTL_SECONDS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

/**
 * POST /api/v1/auth/password/reset — public. Consumes a resetToken minted
 * by either the invite flow (POST /api/v1/users) or the forgot-password
 * flow (POST /api/v1/auth/password/forgot) — both are mechanically the
 * same "set a new password via a link" action.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const body = schema.parse(await req.json().catch(() => ({})));

  const user = await prisma.user.findUnique({ where: { resetToken: body.token } });
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() < Date.now()) {
    return fail('INVALID_TOKEN', 'This link is invalid or has expired', { status: 400 });
  }

  const wasPending = user.status === 'PENDING_VERIFICATION';
  const passwordHash = await hashPassword(body.newPassword);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
      ...(wasPending ? { status: 'ACTIVE', emailVerified: true } : {}),
    },
  });

  await destroyAllUserSessions(user.id);

  const session = await createSession({
    userId: updated.id,
    tenantId: updated.tenantId,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  await auditLog({
    tenantId: updated.tenantId,
    userId: updated.id,
    action: wasPending ? 'user.invite_accepted' : 'user.password_reset',
    resource: 'User',
    resourceId: updated.id,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  const csrfToken = generateCsrfToken();
  const res = ok({
    user: { id: updated.id, email: updated.email, firstName: updated.firstName, lastName: updated.lastName },
    permissions: session.permissions,
    csrfToken,
  });

  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SECONDS,
  });
  res.cookies.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}, { rateLimit: 'auth' });
