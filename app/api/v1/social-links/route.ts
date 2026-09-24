import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission, publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

const PLATFORMS = [
  'FACEBOOK', 'INSTAGRAM', 'TWITTER', 'TIKTOK', 'YOUTUBE',
  'LINKEDIN', 'WHATSAPP', 'TELEGRAM', 'SNAPCHAT', 'PINTEREST',
] as const;

/** GET /api/v1/social-links — the tenant's social profiles (public or admin). */
export const GET = withRoute(async (req: NextRequest) => {
  let tenantId: string;
  try {
    const ctx = await requirePermission(req, 'config:settings:read');
    tenantId = ctx.tenantId;
  } catch {
    tenantId = await publicTenant(req);
  }

  const socialLinks = await prisma.socialLink.findMany({
    where: { tenantId },
    orderBy: { sortOrder: 'asc' },
  });
  return ok({ socialLinks });
});

const putSchema = z.object({
  links: z
    .array(
      z.object({
        platform: z.enum(PLATFORMS),
        // Empty string means "remove this one" — the admin form sends every
        // platform row back, filled in or not.
        url: z.string().trim().url('Enter a full URL including https://').or(z.literal('')),
        isVisible: z.boolean().optional().default(true),
      }),
    )
    .max(PLATFORMS.length),
});

/**
 * PUT /api/v1/social-links — replace the full set. Platforms sent with an
 * empty url are deleted, so the admin form can just post its whole state.
 */
export const PUT = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'config:settings:write');
  const body = putSchema.parse(await req.json().catch(() => ({})));

  const before = await prisma.socialLink.findMany({ where: { tenantId: ctx.tenantId } });

  const keep = body.links.filter((l) => l.url !== '');
  const remove = body.links.filter((l) => l.url === '').map((l) => l.platform);

  await prisma.$transaction([
    ...(remove.length
      ? [prisma.socialLink.deleteMany({ where: { tenantId: ctx.tenantId, platform: { in: remove as never } } })]
      : []),
    ...keep.map((l, i) =>
      prisma.socialLink.upsert({
        where: { tenantId_platform: { tenantId: ctx.tenantId, platform: l.platform as never } },
        update: { url: l.url, isVisible: l.isVisible ?? true, sortOrder: i },
        create: {
          tenantId: ctx.tenantId,
          platform: l.platform as never,
          url: l.url,
          isVisible: l.isVisible ?? true,
          sortOrder: i,
        },
      }),
    ),
  ]);

  const socialLinks = await prisma.socialLink.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { sortOrder: 'asc' },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'social_links.updated',
    resource: 'SocialLink',
    resourceId: ctx.tenantId,
    before: { links: before.map((l) => ({ platform: l.platform, url: l.url })) },
    after: { links: socialLinks.map((l) => ({ platform: l.platform, url: l.url })) },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ socialLinks });
});
