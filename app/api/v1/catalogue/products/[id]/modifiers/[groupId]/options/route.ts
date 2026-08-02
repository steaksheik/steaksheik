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

const optionSchema = z.object({
  name: z.string().min(1).max(200),
  priceAdjustment: z.number().default(0),
  sortOrder: z.number().int().default(0),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
});

/** POST /api/v1/catalogue/products/:id/modifiers/:groupId/options — add one option to an existing modifier group. */
export const POST = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const productId = getParam(params, 'id');
  const groupId = getParam(params, 'groupId');
  const body = optionSchema.parse(await req.json().catch(() => ({})));

  const group = await prisma.modifierGroup.findFirst({ where: { id: groupId, productId } });
  if (!group) throw Errors.notFound('Modifier group not found');
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId: ctx.tenantId } });
  if (!product) throw Errors.notFound('Product not found');

  const modifier = await prisma.modifier.create({
    data: {
      groupId,
      name: body.name,
      priceAdjustment: body.priceAdjustment,
      sortOrder: body.sortOrder,
      isDefault: body.isDefault,
      isAvailable: body.isAvailable,
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.modifier.created',
    resource: 'Modifier',
    resourceId: modifier.id,
    after: { name: modifier.name, priceAdjustment: Number(modifier.priceAdjustment) },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ modifier }, { status: 201 });
});
