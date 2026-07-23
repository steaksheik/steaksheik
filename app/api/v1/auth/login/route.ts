import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { Errors } from '@/lib/api/errors';
import { resolveTenantId } from '@/lib/tenant';
import { getClientIp } from '@/lib/auth/context';
import { auditLog } from '@/lib/audit/service';
import { generateCsrfToken } from '@/lib/security/csrf';
import { SESSION_COOKIE, CSRF_COOKIE, SESSION_TTL_SECONDS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = withRoute(async (req: NextRequest) => {
  const body = schema.parse(await req.json().catch(() => ({})));
  const tenantId = await resolveTenantId(req);
  if (!tenantId) throw Errors.notFound('Tenant not found');

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: body.email.toLowerCase() } },
  });

  if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(body.password, user.passwordHash))) {
    await auditLog({
      tenantId,
      userId: user?.id ?? null,
      action: 'auth.login_failed',
      resource: 'Session',
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
      metadata: { email: body.email },
    });
    throw Errors.invalidCredentials();
  }

  const session = await createSession({
    userId: user.id,
    tenantId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
  await auditLog({
    tenantId,
    userId: user.id,
    action: 'auth.login',
    resource: 'Session',
    resourceId: session.sessionId,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  const csrfToken = generateCsrfToken();
  const res = ok({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    permissions: session.permissions,
    csrfToken,
    expiresAt: session.expiresAt,
  });

  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  res.cookies.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}, { rateLimit: 'auth' });
