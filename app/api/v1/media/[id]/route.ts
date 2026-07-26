
import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { getConfiguredStorage } from '@/lib/plugins/storage';
import { auditLog } from '@/lib/audit/service';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/** DELETE /api/v1/media/:id — remove an asset from the media library and, best-effort, from storage. */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'branding:assets:delete');
  const id = Array.isArray(params?.id) ? params!.id[0] : params?.id;
  if (!id) throw Errors.validation('Missing asset ID');

  const asset = await prisma.mediaAsset.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!asset) throw Errors.notFound('Asset not found');

  const storage = await getConfiguredStorage();
  if (storage.delete) {
    await storage.delete(asset.key).catch(() => undefined);
  }

  await prisma.mediaAsset.delete({ where: { id } });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'media.deleted',
    resource: 'Media',
    resourceId: id,
    before: { key: asset.key, url: asset.url, folder: asset.folder },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ deleted: true });
});
