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

/** GET /api/v1/catalogue/products/:id/images */
export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:read');
  const productId = getId(params);

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId: ctx.tenantId } });
  if (!product) throw Errors.notFound('Product not found');

  const images = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: 'asc' },
  });

  return ok({ images });
});

const addSchema = z.object({
  url: z.string().url(),
  altText: z.string().max(500).optional().nullable(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

/** POST /api/v1/catalogue/products/:id/images */
export const POST = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const productId = getId(params);
  const body = addSchema.parse(await req.json().catch(() => ({})));

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId: ctx.tenantId } });
  if (!product) throw Errors.notFound('Product not found');

  // If setting as primary, unset other primaries
  if (body.isPrimary) {
    await prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
  }

  const image = await prisma.productImage.create({
    data: { productId, ...body },
  });

  return ok({ image }, { status: 201 });
});
