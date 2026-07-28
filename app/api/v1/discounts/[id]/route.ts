
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

function getId(params?: Record<string, string | string[]>): string {
  const id = params?.id;
  return (Array.isArray(id) ? id[0] : id) ?? '';
}

/** GET /api/v1/discounts/:id */
export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'discounts:codes:read');
  const id = getId(params);

  const discount = await prisma.discount.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      category: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      _count: { select: { redemptions: true } },
    },
  });
  if (!discount) throw Errors.notFound('Discount not found');

  return ok({ discount });
});

const updateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/).optional(),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  value: z.number().positive().optional(),
  minSubtotal: z.number().positive().optional().nullable(),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  maxRedemptionsPerCustomer: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  categoryId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
});

/** PUT /api/v1/discounts/:id */
export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'discounts:codes:write');
  const id = getId(params);
  const body = updateSchema.parse(await req.json().catch(() => ({})));

  const before = await prisma.discount.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!before) throw Errors.notFound('Discount not found');

  const value = body.type ?? before.type;
  if (value === 'PERCENTAGE' && body.value != null && body.value > 100) {
    throw new Error('Percentage value cannot exceed 100');
  }

  if (body.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: body.categoryId, tenantId: ctx.tenantId } });
    if (!cat) throw new Error('Category not found in this tenant');
  }
  if (body.productId) {
    const prod = await prisma.product.findFirst({ where: { id: body.productId, tenantId: ctx.tenantId } });
    if (!prod) throw new Error('Product not found in this tenant');
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    if (k === 'code') data[k] = (v as string).trim().toUpperCase();
    else if (k === 'startsAt' || k === 'endsAt') data[k] = v ? new Date(v as string) : null;
    else data[k] = v;
  }

  const discount = await prisma.discount.update({
    where: { id },
    data,
    include: {
      category: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      _count: { select: { redemptions: true } },
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'discounts.code.updated',
    resource: 'Discount',
    resourceId: id,
    before: { code: before.code, isActive: before.isActive },
    after: { code: discount.code, isActive: discount.isActive },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'discounts.code.updated',
  });

  return ok({ discount });
});

/** DELETE /api/v1/discounts/:id — only allowed for never-used codes; use PUT isActive:false to deactivate a used one. */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'discounts:codes:delete');
  const id = getId(params);

  const discount = await prisma.discount.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!discount) throw Errors.notFound('Discount not found');
  if (discount._count.redemptions > 0) {
    throw Errors.conflict('This code has been used and cannot be deleted — deactivate it instead');
  }

  await prisma.discount.delete({ where: { id } });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'discounts.code.deleted',
    resource: 'Discount',
    resourceId: id,
    before: { code: discount.code },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'discounts.code.deleted',
  });

  return ok({ deleted: true });
});
