import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'identity:roles:read');
  const roles = await prisma.role.findMany({
    where: { tenantId: ctx.tenantId },
    include: { rolePermissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const data = (roles ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    userCount: r._count?.userRoles ?? 0,
    permissions: (r.rolePermissions ?? []).map((rp) => rp.permission ? `${rp.permission.resource}:${rp.permission.action}` : null).filter(Boolean),
  }));
  return ok({ roles: data });
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional(),
});

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'identity:roles:write');
  const body = createSchema.parse(await req.json().catch(() => ({})));
  const role = await prisma.role.create({
    data: {
      tenantId: ctx.tenantId,
      name: body.name,
      displayName: body.name,
      description: body.description ?? null,
      isSystem: false,
      rolePermissions: body.permissionIds?.length
        ? { create: body.permissionIds.map((permissionId) => ({ permissionId })) }
        : undefined,
    },
  });
  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: 'role.created', resource: 'Role', resourceId: role.id, after: { name: role.name }, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  return ok({ role }, { status: 201 });
});
