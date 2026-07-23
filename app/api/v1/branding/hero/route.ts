import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission, publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

/**
 * Hero configuration is stored in HomepageSection (type = HERO) as JSON.
 * `content` holds the editable hero payload; `settings` mirrors autoplay.
 */
const slideSchema = z.object({
  type: z.enum(['image', 'video']),
  url: z.string().url(),
  alt: z.string().max(300).optional().nullable(),
});

const heroSchema = z.object({
  enabled: z.boolean().default(true),
  slides: z.array(slideSchema).max(12).default([]),
  autoplayMs: z.number().int().min(2000).max(30000).default(6000),
  headline: z.string().max(200).optional().nullable(),
  subheadline: z.string().max(400).optional().nullable(),
  ctaText: z.string().max(60).optional().nullable(),
  ctaHref: z.string().max(300).optional().nullable(),
  secondaryCtaText: z.string().max(60).optional().nullable(),
  secondaryCtaHref: z.string().max(300).optional().nullable(),
  overlay: z.boolean().default(true),
});

export type HeroConfig = z.infer<typeof heroSchema>;

const DEFAULT_HERO: HeroConfig = {
  enabled: true,
  slides: [],
  autoplayMs: 6000,
  headline: null,
  subheadline: null,
  ctaText: null,
  ctaHref: null,
  secondaryCtaText: null,
  secondaryCtaHref: null,
  overlay: true,
};

/** GET /api/v1/branding/hero — read hero config (public or admin). */
export const GET = withRoute(async (req: NextRequest) => {
  let tenantId: string;
  try {
    const ctx = await requirePermission(req, 'branding:brand:read');
    tenantId = ctx.tenantId;
  } catch {
    tenantId = await publicTenant(req);
  }

  const section = await prisma.homepageSection.findUnique({
    where: { tenantId_type: { tenantId, type: 'HERO' } },
  });

  const content = (section?.content ?? {}) as Record<string, unknown>;
  const hero: HeroConfig = { ...DEFAULT_HERO, ...content, enabled: section?.isVisible ?? true };
  return ok({ hero });
});

/** PUT /api/v1/branding/hero — save hero config. */
export const PUT = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'branding:brand:write');
  const hero = heroSchema.parse(await req.json().catch(() => ({})));

  const before = await prisma.homepageSection.findUnique({
    where: { tenantId_type: { tenantId: ctx.tenantId, type: 'HERO' } },
  });

  const section = await prisma.homepageSection.upsert({
    where: { tenantId_type: { tenantId: ctx.tenantId, type: 'HERO' } },
    update: {
      title: hero.headline ?? null,
      subtitle: hero.subheadline ?? null,
      content: hero as unknown as object,
      isVisible: hero.enabled,
      settings: { autoplayMs: hero.autoplayMs },
      updatedAt: new Date(),
    },
    create: {
      tenantId: ctx.tenantId,
      type: 'HERO',
      title: hero.headline ?? null,
      subtitle: hero.subheadline ?? null,
      content: hero as unknown as object,
      isVisible: hero.enabled,
      sortOrder: 0,
      settings: { autoplayMs: hero.autoplayMs },
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'branding.hero.updated',
    resource: 'HomepageSection',
    resourceId: section.id,
    before,
    after: section,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ hero });
});
