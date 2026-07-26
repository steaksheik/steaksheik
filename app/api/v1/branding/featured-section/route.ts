
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission, publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

/**
 * Homepage "Featured Products" section config, stored in HomepageSection
 * (type = FEATURED_PRODUCTS) the same way the hero is — title/subtitle and
 * visibility are native columns, `limit` lives in `content` as JSON. Which
 * products actually show is controlled by the "Featured" toggle on each
 * product in the Catalogue, not here — this only controls the section itself.
 */
const featuredSectionSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().trim().max(100).optional().nullable(),
  subtitle: z.string().trim().max(300).optional().nullable(),
  limit: z.number().int().min(2).max(10).default(5),
});

export type FeaturedSectionInput = z.infer<typeof featuredSectionSchema>;

const DEFAULT: FeaturedSectionInput = {
  enabled: true,
  title: 'Our Most Loved Steaks',
  subtitle: null,
  limit: 5,
};

/** GET /api/v1/branding/featured-section — read config (public or admin). */
export const GET = withRoute(async (req: NextRequest) => {
  let tenantId: string;
  try {
    const ctx = await requirePermission(req, 'branding:brand:read');
    tenantId = ctx.tenantId;
  } catch {
    tenantId = await publicTenant(req);
  }

  const section = await prisma.homepageSection.findUnique({
    where: { tenantId_type: { tenantId, type: 'FEATURED_PRODUCTS' } },
  });

  if (!section) return ok({ featuredSection: DEFAULT });

  const content = (section.content ?? {}) as Record<string, unknown>;
  return ok({
    featuredSection: {
      enabled: section.isVisible,
      title: section.title ?? DEFAULT.title,
      subtitle: section.subtitle ?? null,
      limit: typeof content.limit === 'number' ? content.limit : DEFAULT.limit,
    },
  });
});

/** PUT /api/v1/branding/featured-section — save config. */
export const PUT = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'branding:brand:write');
  const body = featuredSectionSchema.parse(await req.json().catch(() => ({})));

  const before = await prisma.homepageSection.findUnique({
    where: { tenantId_type: { tenantId: ctx.tenantId, type: 'FEATURED_PRODUCTS' } },
  });

  const section = await prisma.homepageSection.upsert({
    where: { tenantId_type: { tenantId: ctx.tenantId, type: 'FEATURED_PRODUCTS' } },
    update: {
      title: body.title || null,
      subtitle: body.subtitle || null,
      content: { limit: body.limit },
      isVisible: body.enabled,
      updatedAt: new Date(),
    },
    create: {
      tenantId: ctx.tenantId,
      type: 'FEATURED_PRODUCTS',
      title: body.title || null,
      subtitle: body.subtitle || null,
      content: { limit: body.limit },
      isVisible: body.enabled,
      sortOrder: 0,
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'branding.featured_section.updated',
    resource: 'HomepageSection',
    resourceId: section.id,
    before,
    after: section,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({
    featuredSection: {
      enabled: body.enabled,
      title: body.title || DEFAULT.title,
      subtitle: body.subtitle ?? null,
      limit: body.limit,
    },
  });
});
