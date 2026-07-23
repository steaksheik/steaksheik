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
  const id = idOf(params);
  const user = await prisma.user.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true, email: true, firstName: true, lastName: true, status: true, emailVerified: true, createdAt: true, updatedAt: true, userRoles: { include: { role: true } } },
  });
  if (!user) throw Errors.notFound('User not found');
  return ok({ user: { ...user, roles: (user.userRoles ?? []).map((ur) => ({ id: ur.role?.id, name: ur.role?.name })) } });
});

const updateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
});

export const PUT = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'identity:users:write');
  const id = idOf(params);
  const existing = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) throw Errors.notFound('User not found');
  const body = updateSchema.parse(await (req as NextRequest).json().catch(() => ({})));
  const user = await prisma.user.update({
    where: { id },
    data: { firstName: body.firstName ?? existing.firstName, lastName: body.lastName ?? existing.lastName, status: body.status ?? existing.status, updatedBy: ctx.session.userId },
    select: { id: true, email: true, firstName: true, lastName: true, status: true },
  });
  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: 'user.updated', resource: 'User', resourceId: id, before: { status: existing.status }, after: { status: user.status }, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  return ok({ user });
});

export const DELETE = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'identity:users:delete');
  const id = idOf(params);
  const existing = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) throw Errors.notFound('User not found');
  await prisma.user.update({ where: { id }, data: { status: 'INACTIVE', updatedBy: ctx.session.userId } });
  await invalidateUserPermissions(id);
  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: 'user.deactivated', resource: 'User', resourceId: id, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  return ok({ id, status: 'INACTIVE' });
});
