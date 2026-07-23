import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const ASSET_TYPES = ['LOGO', 'FAVICON', 'HERO_IMAGE', 'BANNER', 'GALLERY', 'OG_IMAGE', 'BACKGROUND', 'ICON'] as const;

/** GET /api/v1/branding/assets — list brand assets. */
export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'branding:brand:read');
  const brand = await prisma.brand.findUnique({ where: { tenantId: ctx.tenantId } });
  if (!brand) return ok({ assets: [] });

  const assets = await prisma.brandAsset.findMany({
    where: { brandId: brand.id },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
  });
  return ok({ assets });
});

const createSchema = z.object({
  type: z.enum(ASSET_TYPES),
  url: z.string().url(),
  altText: z.string().max(500).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().max(100).optional(),
  sortOrder: z.number().int().default(0),
});

/** POST /api/v1/branding/assets — add a brand asset. */
export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'branding:assets:write');
  const body = createSchema.parse(await req.json().catch(() => ({})));

  const brand = await prisma.brand.findUnique({ where: { tenantId: ctx.tenantId } });
  if (!brand) throw Errors.notFound('Brand not found. Create brand first.');

  const asset = await prisma.brandAsset.create({
    data: { brandId: brand.id, ...body },
  });

  // Auto-update brand logoUrl / faviconUrl
  if (body.type === 'LOGO') {
    await prisma.brand.update({ where: { id: brand.id }, data: { logoUrl: body.url } });
  } else if (body.type === 'FAVICON') {
    await prisma.brand.update({ where: { id: brand.id }, data: { faviconUrl: body.url } });
  }

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'branding.asset.created',
    resource: 'BrandAsset',
    resourceId: asset.id,
    after: asset,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ asset }, { status: 201 });
});
