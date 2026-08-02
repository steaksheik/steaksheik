import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

function getParam(params: Record<string, string | string[]> | undefined, key: string): string {
  const v = params?.[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

async function requireOwnedGroup(tenantId: string, productId: string, groupId: string) {
  const group = await prisma.modifierGroup.findFirst({ where: { id: groupId, productId } });
  if (!group) throw Errors.notFound('Modifier group not found');
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw Errors.notFound('Product not found');
  return group;
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  isRequired: z.boolean().optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

/** PUT /api/v1/catalogue/products/:id/modifiers/:groupId — update a modifier group's own fields. */
export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const productId = getParam(params, 'id');
  const groupId = getParam(params, 'groupId');
  const body = updateSchema.parse(await req.json().catch(() => ({})));

  const before = await requireOwnedGroup(ctx.tenantId, productId, groupId);

  const group = await prisma.modifierGroup.update({
    where: { id: groupId },
    data: body,
    include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.modifier_group.updated',
    resource: 'ModifierGroup',
    resourceId: groupId,
    before: { name: before.name },
    after: { name: group.name },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ group });
});

/** DELETE /api/v1/catalogue/products/:id/modifiers/:groupId — delete a modifier group (cascades its options). */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const productId = getParam(params, 'id');
  const groupId = getParam(params, 'groupId');

  const before = await requireOwnedGroup(ctx.tenantId, productId, groupId);

  await prisma.modifierGroup.delete({ where: { id: groupId } });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.modifier_group.deleted',
    resource: 'ModifierGroup',
    resourceId: groupId,
    before: { name: before.name },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ deleted: true });
});
