import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { invalidateUserPermissions } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

function strOf(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v ?? '');
}

export const DELETE = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'identity:users:write');
  const userId = strOf(params?.id);
  const roleId = strOf(params?.roleId);
  await prisma.userRole.deleteMany({ where: { userId, roleId } });
  await invalidateUserPermissions(userId);
  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: 'user.role_removed', resource: 'User', resourceId: userId, before: { roleId }, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  return ok({ userId, roleId, removed: true });
});
