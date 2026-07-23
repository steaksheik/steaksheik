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

const variantSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(100).optional().nullable(),
  price: z.number().positive(),
  sortOrder: z.number().int().default(0),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  attributes: z.record(z.unknown()).optional().nullable(),
});

/** POST /api/v1/catalogue/products/:id/variants */
export const POST = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const productId = getId(params);
  const body = variantSchema.parse(await req.json().catch(() => ({})));

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId: ctx.tenantId } });
  if (!product) throw Errors.notFound('Product not found');

  if (body.isDefault) {
    await prisma.productVariant.updateMany({ where: { productId }, data: { isDefault: false } });
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      name: body.name,
      sku: body.sku,
      price: body.price,
      sortOrder: body.sortOrder,
      isDefault: body.isDefault,
      isAvailable: body.isAvailable,
      attributes: (body.attributes ?? null) as never,
    },
  });

  return ok({ variant }, { status: 201 });
});

/** GET /api/v1/catalogue/products/:id/variants */
export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:read');
  const productId = getId(params);

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId: ctx.tenantId } });
  if (!product) throw Errors.notFound('Product not found');

  const variants = await prisma.productVariant.findMany({
    where: { productId },
    orderBy: { sortOrder: 'asc' },
  });

  return ok({ variants });
});
