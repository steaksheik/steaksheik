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

/** GET /api/v1/catalogue/categories/:id */
export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:categories:read');
  const id = getId(params);

  const category = await prisma.category.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      children: { orderBy: { sortOrder: 'asc' } },
      products: {
        orderBy: { sortOrder: 'asc' },
        include: {
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          _count: { select: { variants: true, modifierGroups: true } },
        },
      },
      _count: { select: { products: true } },
    },
  });
  if (!category) throw Errors.notFound('Category not found');

  return ok({ category });
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

/** PUT /api/v1/catalogue/categories/:id */
export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:categories:write');
  const id = getId(params);
  const body = updateSchema.parse(await req.json().catch(() => ({})));

  const before = await prisma.category.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!before) throw Errors.notFound('Category not found');

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.slug !== undefined) data.slug = body.slug;
  if (body.description !== undefined) data.description = body.description;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
  if (body.parentId !== undefined) data.parentId = body.parentId;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  if (body.status !== undefined) data.status = body.status;
  if (body.metadata !== undefined) data.metadata = (body.metadata ?? {}) as never;

  const category = await prisma.category.update({
    where: { id },
    data,
    include: { _count: { select: { products: true } } },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.category.updated',
    resource: 'Category',
    resourceId: id,
    before,
    after: category,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'catalogue.category.updated',
  });

  return ok({ category });
});

/** DELETE /api/v1/catalogue/categories/:id */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'catalogue:categories:delete');
  const id = getId(params);

  const category = await prisma.category.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { _count: { select: { products: true } } },
  });
  if (!category) throw Errors.notFound('Category not found');
  if (category._count.products > 0) {
    throw Errors.conflict(`Cannot delete category with ${category._count.products} product(s). Move or delete products first.`);
  }

  await prisma.category.delete({ where: { id } });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'catalogue.category.deleted',
    resource: 'Category',
    resourceId: id,
    before: category,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'catalogue.category.deleted',
  });

  return ok({ deleted: true });
});
