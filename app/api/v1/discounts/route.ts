
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/discounts — list discount codes. */
export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'discounts:codes:read');

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const skip = Number(url.searchParams.get('skip')) || 0;

  const [discounts, total] = await Promise.all([
    prisma.discount.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        _count: { select: { redemptions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    }),
    prisma.discount.count({ where: { tenantId: ctx.tenantId } }),
  ]);

  return ok({ discounts, total, limit, skip, hasMore: skip + limit < total });
});

const createSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, hyphens and underscores only'),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  value: z.number().positive(),
  minSubtotal: z.number().positive().optional().nullable(),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  maxRedemptionsPerCustomer: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  categoryId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
});

/** POST /api/v1/discounts — create discount code. */
export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'discounts:codes:write');
  const body = createSchema.parse(await req.json().catch(() => ({})));

  if (body.type === 'PERCENTAGE' && body.value > 100) {
    throw new Error('Percentage value cannot exceed 100');
  }

  const code = body.code.trim().toUpperCase();

  if (body.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: body.categoryId, tenantId: ctx.tenantId } });
    if (!cat) throw new Error('Category not found in this tenant');
  }
  if (body.productId) {
    const prod = await prisma.product.findFirst({ where: { id: body.productId, tenantId: ctx.tenantId } });
    if (!prod) throw new Error('Product not found in this tenant');
  }

  const discount = await prisma.discount.create({
    data: {
      tenantId: ctx.tenantId,
      code,
      description: body.description,
      type: body.type,
      value: body.value,
      minSubtotal: body.minSubtotal,
      maxDiscountAmount: body.maxDiscountAmount,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      maxRedemptions: body.maxRedemptions,
      maxRedemptionsPerCustomer: body.maxRedemptionsPerCustomer,
      isActive: body.isActive,
      categoryId: body.categoryId || null,
      productId: body.productId || null,
    },
    include: {
      category: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      _count: { select: { redemptions: true } },
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'discounts.code.created',
    resource: 'Discount',
    resourceId: discount.id,
    after: { code: discount.code, type: discount.type, value: Number(discount.value) },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'discounts.code.created',
  });

  return ok({ discount }, { status: 201 });
});
