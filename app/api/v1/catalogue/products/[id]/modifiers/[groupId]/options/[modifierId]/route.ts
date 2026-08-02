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

async function requireOwnedModifier(tenantId: string, productId: string, groupId: string, modifierId: string) {
  const modifier = await prisma.modifier.findFirst({ where: { id: modifierId, groupId } });
  if (!modifier) throw Errors.notFound('Modifier not found');
  const group = await prisma.modifierGroup.findFirst({ where: { id: groupId, productId } });
  if (!group) throw Errors.notFound('Modifier group not found');
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw Errors.notFound('Product not found');
  return modifier;
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  priceAdjustment: z.number().optional(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

/** PUT /api/v1/catalogue/products/:id/modifiers/:groupId/options/:modifierId — update one option. */
export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const productId = getParam(params, 'id');
  const groupId = getParam(params, 'groupId');
  const modifierId = getParam(params, 'modifierId');
  const body = updateSchema.parse(await req.json().catch(() => ({})));

  const before = await requireOwnedModifier(ctx.tenantId, productId, groupId, modifierId);

  const modifier = await prisma.modifier.update({
    where: { id: modifierId },
    data: body,
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.modifier.updated',
    resource: 'Modifier',
    resourceId: modifierId,
    before: { name: before.name, priceAdjustment: Number(before.priceAdjustment) },
    after: { name: modifier.name, priceAdjustment: Number(modifier.priceAdjustment) },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ modifier });
});

/** DELETE /api/v1/catalogue/products/:id/modifiers/:groupId/options/:modifierId — delete one option. */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const productId = getParam(params, 'id');
  const groupId = getParam(params, 'groupId');
  const modifierId = getParam(params, 'modifierId');

  const before = await requireOwnedModifier(ctx.tenantId, productId, groupId, modifierId);

  await prisma.modifier.delete({ where: { id: modifierId } });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.modifier.deleted',
    resource: 'Modifier',
    resourceId: modifierId,
    before: { name: before.name },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ deleted: true });
});
