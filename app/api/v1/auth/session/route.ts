import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { optionalAuth } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await optionalAuth(req);
  if (!ctx) return ok({ authenticated: false, user: null });
  return ok({
    authenticated: true,
    user: {
      id: ctx.session.userId,
      email: ctx.session.email,
      firstName: ctx.session.firstName,
      lastName: ctx.session.lastName,
    },
    tenantId: ctx.tenantId,
    permissions: ctx.session.permissions,
    expiresAt: ctx.session.expiresAt,
  });
});
