
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  folder: z.string().trim().optional(),
  kind: z.enum(['image', 'video']).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/v1/media — list this tenant's media library (everything uploaded via /api/v1/media/upload). */
export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'branding:assets:write');
  const url = new URL(req.url);
  const q = querySchema.parse(Object.fromEntries(url.searchParams));

  const where = {
    tenantId: ctx.tenantId,
    ...(q.folder ? { folder: q.folder } : {}),
    ...(q.kind ? { kind: q.kind } : {}),
    ...(q.search ? { key: { contains: q.search, mode: 'insensitive' as const } } : {}),
  };

  const [assets, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      skip: q.offset,
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return ok({
    assets: assets.map((a) => ({
      id: a.id,
      url: a.url,
      key: a.key,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      folder: a.folder,
      kind: a.kind,
      createdAt: a.createdAt,
      uploadedBy: a.uploadedBy ? `${a.uploadedBy.firstName} ${a.uploadedBy.lastName}`.trim() : null,
    })),
    total,
  });
});
