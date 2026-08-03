import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';
import { destroyAllUserSessions } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

function idOf(params?: Record<string, string | string[]>): string {
  const id = params?.id;
  return Array.isArray(id) ? id[0] : (id ?? '');
}

/**
 * DELETE /api/v1/users/:id/permanent — irreversibly removes the user row,
 * distinct from the existing DELETE /api/v1/users/:id (which only
 * deactivates). Gated by the same identity:users:delete permission used
 * for deactivation — by default only Super Admin/Tenant Admin hold it, but
 * it can be granted to any other user the same way any permission is: by
 * assigning them a role that includes it via Admin -> Users & Roles.
 */
export const DELETE = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'identity:users:delete');
  const id = idOf(params);

  if (id === ctx.session.userId) {
    return fail('CANNOT_DELETE_SELF', 'You cannot delete your own account', { status: 400 });
  }

  const existing = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) throw Errors.notFound('User not found');

  await destroyAllUserSessions(id);
  await prisma.user.delete({ where: { id } });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'user.deleted',
    resource: 'User',
    resourceId: id,
    before: { email: existing.email, firstName: existing.firstName, lastName: existing.lastName },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ id, deleted: true });
});
