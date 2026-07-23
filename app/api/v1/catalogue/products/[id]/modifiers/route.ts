import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

function getId(params?: Record<string, string | string[]>): string {
  const id = params?.id;
  return (Array.isArray(id) ? id[0] : id) ?? '';
}

const groupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  isRequired: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  sortOrder: z.number().int().default(0),
  modifiers: z.array(z.object({
    name: z.string().min(1).max(200),
    priceAdjustment: z.number().default(0),
    sortOrder: z.number().int().default(0),
    isDefault: z.boolean().default(false),
    isAvailable: z.boolean().default(true),
  })).default([]),
});

/** POST /api/v1/catalogue/products/:id/modifiers — create modifier group with modifiers. */
export const POST = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const productId = getId(params);
  const body = groupSchema.parse(await req.json().catch(() => ({})));

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId: ctx.tenantId } });
  if (!product) throw Errors.notFound('Product not found');

  const group = await prisma.modifierGroup.create({
    data: {
      productId,
      name: body.name,
      description: body.description,
      isRequired: body.isRequired,
      minSelect: body.minSelect,
      maxSelect: body.maxSelect,
      sortOrder: body.sortOrder,
      modifiers: {
        create: body.modifiers.map((m, i) => ({
          name: m.name,
          priceAdjustment: m.priceAdjustment,
          sortOrder: m.sortOrder || i,
          isDefault: m.isDefault,
          isAvailable: m.isAvailable,
        })),
      },
    },
    include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
  });

  return ok({ group }, { status: 201 });
});

/** GET /api/v1/catalogue/products/:id/modifiers */
export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:read');
  const productId = getId(params);

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId: ctx.tenantId } });
  if (!product) throw Errors.notFound('Product not found');

  const groups = await prisma.modifierGroup.findMany({
    where: { productId },
    include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });

  return ok({ groups });
});
