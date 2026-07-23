import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission, publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/catalogue/products — list products with filters. */
export const GET = withRoute(async (req: NextRequest) => {
  let tenantId: string;
  let isAdmin = false;
  try {
    const ctx = await requirePermission(req, 'catalogue:products:read');
    tenantId = ctx.tenantId;
    isAdmin = true;
  } catch {
    tenantId = await publicTenant(req);
  }

  const url = new URL(req.url);
  const categoryId = url.searchParams.get('categoryId');
  const status = url.searchParams.get('status');
  const featured = url.searchParams.get('featured');
  const search = url.searchParams.get('search');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const skip = Number(url.searchParams.get('skip')) || 0;

  const where: Record<string, unknown> = { tenantId };
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  else if (!isAdmin) where.status = 'PUBLISHED';
  if (featured === 'true') where.isFeatured = true;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: where as never,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { variants: true, modifierGroups: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: limit,
      skip,
    }),
    prisma.product.count({ where: where as never }),
  ]);

  return ok({ products, total, limit, skip, hasMore: skip + limit < total });
});

const createSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(300),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  basePrice: z.number().positive(),
  compareAtPrice: z.number().positive().optional().nullable(),
  currency: z.string().length(3).default('GBP'),
  sku: z.string().max(100).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'OUT_OF_STOCK']).default('DRAFT'),
  isFeatured: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  nutritionalInfo: z.record(z.unknown()).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

/** POST /api/v1/catalogue/products — create product. */
export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'catalogue:products:write');
  const body = createSchema.parse(await req.json().catch(() => ({})));

  // Verify category belongs to tenant
  const cat = await prisma.category.findFirst({ where: { id: body.categoryId, tenantId: ctx.tenantId } });
  if (!cat) throw new Error('Category not found in this tenant');

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      categoryId: body.categoryId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      shortDescription: body.shortDescription,
      basePrice: body.basePrice,
      compareAtPrice: body.compareAtPrice,
      currency: body.currency,
      sku: body.sku,
      status: body.status,
      isFeatured: body.isFeatured,
      isAvailable: body.isAvailable,
      sortOrder: body.sortOrder,
      nutritionalInfo: (body.nutritionalInfo ?? null) as never,
      metadata: (body.metadata ?? null) as never,
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: true,
      _count: { select: { variants: true, modifierGroups: true } },
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.product.created',
    resource: 'Product',
    resourceId: product.id,
    after: { name: product.name, slug: product.slug, categoryId: product.categoryId },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'catalogue.product.created',
  });

  return ok({ product }, { status: 201 });
});
