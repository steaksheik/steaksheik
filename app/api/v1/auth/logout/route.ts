import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { destroySession } from '@/lib/auth/session';
import { optionalAuth } from '@/lib/auth/context';
import { auditLog } from '@/lib/audit/service';
import { SESSION_COOKIE, CSRF_COOKIE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await optionalAuth(req);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  await destroySession(token);
  if (ctx) {
    await auditLog({
      tenantId: ctx.tenantId,
      userId: ctx.session.userId,
      action: 'auth.logout',
      resource: 'Session',
      resourceId: ctx.session.sessionId,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
  const res = ok({ loggedOut: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(CSRF_COOKIE);
  return res;
});
