import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { destroyAllUserSessions } from '@/lib/auth/session';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

function idOf(params?: Record<string, string | string[]>): string {
  const id = params?.id;
  return Array.isArray(id) ? id[0] : (id ?? '');
}

const schema = z.object({ newPassword: z.string().min(8) });

/**
 * Admin-initiated password reset — sets a new password for another user
 * without needing their current one. Distinct from
 * /api/v1/auth/password/change, which is self-service and requires the
 * caller's own current password.
 */
export const POST = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'identity:users:write');
  const id = idOf(params);
  const existing = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) throw Errors.notFound('User not found');

  const body = schema.parse(await (req as NextRequest).json().catch(() => ({})));
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(body.newPassword), updatedBy: ctx.session.userId },
  });
  await destroyAllUserSessions(id);
  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'user.password_reset',
    resource: 'User',
    resourceId: id,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return ok({ id, reset: true });
});
