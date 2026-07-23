import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission, publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { publishEvent } from '@/lib/events/bus';

export const dynamic = 'force-dynamic';

/** GET /api/v1/catalogue/categories — list categories. */
export const GET = withRoute(async (req: NextRequest) => {
  let tenantId: string;
  try {
    const ctx = await requirePermission(req, 'catalogue:categories:read');
    tenantId = ctx.tenantId;
  } catch {
    tenantId = await publicTenant(req);
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const parentId = url.searchParams.get('parentId');
  const includeProducts = url.searchParams.get('includeProducts') === 'true';

  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status;
  if (parentId === 'null') where.parentId = null;
  else if (parentId) where.parentId = parentId;

  const categories = await prisma.category.findMany({
    where: where as never,
    include: {
      children: { orderBy: { sortOrder: 'asc' } },
      ...(includeProducts ? { products: { where: { status: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' }, take: 20, include: { images: { where: { isPrimary: true }, take: 1 } } } } : {}),
      _count: { select: { products: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return ok({ categories, total: categories.length });
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
  metadata: z.record(z.unknown()).optional().nullable(),
});

/** POST /api/v1/catalogue/categories — create category. */
export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'catalogue:categories:write');
  const body = createSchema.parse(await req.json().catch(() => ({})));

  const category = await prisma.category.create({
    data: {
      tenantId: ctx.tenantId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      imageUrl: body.imageUrl,
      parentId: body.parentId,
      sortOrder: body.sortOrder,
      status: body.status,
      metadata: (body.metadata ?? {}) as never,
    },
    include: { _count: { select: { products: true } } },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.category.created',
    resource: 'Category',
    resourceId: category.id,
    after: category,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'catalogue.category.created',
  });

  return ok({ category }, { status: 201 });
});
