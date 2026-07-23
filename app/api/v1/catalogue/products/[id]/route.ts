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

/** GET /api/v1/catalogue/products/:id */
export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:read');
  const id = getId(params);

  const product = await prisma.product.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { orderBy: { sortOrder: 'asc' } },
      modifierGroups: {
        orderBy: { sortOrder: 'asc' },
        include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
  if (!product) throw Errors.notFound('Product not found');

  return ok({ product });
});

const updateSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).max(300).optional(),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(5000).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  basePrice: z.number().positive().optional(),
  compareAtPrice: z.number().positive().optional().nullable(),
  currency: z.string().length(3).optional(),
  sku: z.string().max(100).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'OUT_OF_STOCK']).optional(),
  isFeatured: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  nutritionalInfo: z.record(z.unknown()).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

/** PUT /api/v1/catalogue/products/:id */
export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const id = getId(params);
  const body = updateSchema.parse(await req.json().catch(() => ({})));

  const before = await prisma.product.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!before) throw Errors.notFound('Product not found');

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) {
      if (k === 'nutritionalInfo' || k === 'metadata') data[k] = (v ?? null) as never;
      else data[k] = v;
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { variants: true, modifierGroups: true } },
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.product.updated',
    resource: 'Product',
    resourceId: id,
    before: { name: before.name, status: before.status },
    after: { name: product.name, status: product.status },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'catalogue.product.updated',
  });

  return ok({ product });
});

/** DELETE /api/v1/catalogue/products/:id */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:products:delete');
  const id = getId(params);

  const product = await prisma.product.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!product) throw Errors.notFound('Product not found');

  await prisma.product.delete({ where: { id } });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.product.deleted',
    resource: 'Product',
    resourceId: id,
    before: { name: product.name },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'catalogue.product.deleted',
  });

  return ok({ deleted: true });
});
