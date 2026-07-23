import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';
import { invalidateUserPermissions } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

function idOf(params?: Record<string, string | string[]>): string {
  const id = params?.id;
  return Array.isArray(id) ? id[0] : (id ?? '');
}

export const GET = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'identity:users:read');
  const userId = idOf(params);
  const roles = await prisma.userRole.findMany({ where: { userId }, include: { role: true } });
  return ok({ roles: (roles ?? []).map((ur) => ({ id: ur.role?.id, name: ur.role?.name, description: ur.role?.description })) });
});

const assignSchema = z.object({ roleId: z.string().min(1) });

export const POST = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'identity:users:write');
  const userId = idOf(params);
  const body = assignSchema.parse(await (req as NextRequest).json().catch(() => ({})));
  const role = await prisma.role.findFirst({ where: { id: body.roleId, tenantId: ctx.tenantId } });
  if (!role) throw Errors.notFound('Role not found');
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: body.roleId } },
    update: {},
    create: { userId, roleId: body.roleId },
  });
  await invalidateUserPermissions(userId);
  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: 'user.role_assigned', resource: 'User', resourceId: userId, after: { roleId: body.roleId }, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  return ok({ userId, roleId: body.roleId }, { status: 201 });
});
