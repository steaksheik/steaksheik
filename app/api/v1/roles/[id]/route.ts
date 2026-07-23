import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

function idOf(params?: Record<string, string | string[]>): string {
  const id = params?.id;
  return Array.isArray(id) ? id[0] : (id ?? '');
}

export const GET = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'identity:roles:read');
  const id = idOf(params);
  const role = await prisma.role.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) throw Errors.notFound('Role not found');
  return ok({ role: { ...role, permissions: (role.rolePermissions ?? []).map((rp) => rp.permission ? `${rp.permission.resource}:${rp.permission.action}` : null).filter(Boolean) } });
});

const updateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional(),
});

export const PUT = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'identity:roles:write');
  const id = idOf(params);
  const existing = await prisma.role.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) throw Errors.notFound('Role not found');
  if (existing.isSystem) throw Errors.forbidden('System roles cannot be modified');
  const body = updateSchema.parse(await (req as NextRequest).json().catch(() => ({})));
  const role = await prisma.$transaction(async (tx) => {
    if (body.permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({ data: body.permissionIds.map((permissionId) => ({ roleId: id, permissionId })), skipDuplicates: true });
    }
    return tx.role.update({ where: { id }, data: { name: body.name ?? existing.name, description: body.description ?? existing.description } });
  });
  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: 'role.updated', resource: 'Role', resourceId: id, after: { name: role.name }, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  return ok({ role });
});
