import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/** DELETE /api/v1/branding/assets/:id */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'branding:assets:delete');
  const id = Array.isArray(params?.id) ? params!.id[0] : params?.id;
  if (!id) throw Errors.validation('Missing asset ID');

  const asset = await prisma.brandAsset.findUnique({
    where: { id },
    include: { brand: true },
  });
  if (!asset || asset.brand.tenantId !== ctx.tenantId) {
    throw Errors.notFound('Asset not found');
  }

  await prisma.brandAsset.delete({ where: { id } });

  // Clear brand logoUrl / faviconUrl if this asset was linked
  if (asset.type === 'LOGO' && asset.brand.logoUrl === asset.url) {
    await prisma.brand.update({ where: { id: asset.brandId }, data: { logoUrl: null } });
  } else if (asset.type === 'FAVICON' && asset.brand.faviconUrl === asset.url) {
    await prisma.brand.update({ where: { id: asset.brandId }, data: { faviconUrl: null } });
  }

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'branding.asset.deleted',
    resource: 'BrandAsset',
    resourceId: id,
    before: asset,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ deleted: true });
});
