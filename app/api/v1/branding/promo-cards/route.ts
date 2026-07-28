
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission, publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

/**
 * Homepage promo cards ("Steak Meal Deals" / "Weekend Special" / "Free
 * Delivery" row), stored in HomepageSection (type = PROMOTIONAL_BANNER) —
 * same mechanism as the hero and featured-products sections.
 */
const promoCardSchema = z.object({
  title: z.string().trim().min(1).max(100),
  subtitle: z.string().trim().max(150).optional().nullable(),
  priceText: z.string().trim().max(30).optional().nullable(),
  imageUrl: z.string().trim().url().optional().nullable(),
  ctaText: z.string().trim().min(1).max(40).default('Order Now'),
  ctaHref: z.string().trim().min(1).max(300),
  style: z.enum(['image', 'accent']).default('image'),
});

const promoCardsSchema = z.object({
  enabled: z.boolean().default(true),
  cards: z.array(promoCardSchema).max(6).default([]),
});

export type PromoCardsInput = z.infer<typeof promoCardsSchema>;

const DEFAULT: PromoCardsInput = {
  enabled: true,
  cards: [
    { title: 'Steak Meal Deals', subtitle: 'SAVE UP TO 20%', priceText: null, imageUrl: null, ctaText: 'Order Now', ctaHref: '/menu', style: 'image' },
    { title: 'Weekend Special', subtitle: 'RIBEYE + 2 SIDES', priceText: '£24.99', imageUrl: null, ctaText: 'Order Now', ctaHref: '/menu', style: 'image' },
    { title: 'Free Delivery', subtitle: 'ON ORDERS OVER £25', priceText: null, imageUrl: null, ctaText: 'Order Now', ctaHref: '/menu', style: 'accent' },
  ],
};

/** GET /api/v1/branding/promo-cards — read config (public or admin). */
export const GET = withRoute(async (req: NextRequest) => {
  let tenantId: string;
  try {
    const ctx = await requirePermission(req, 'branding:brand:read');
    tenantId = ctx.tenantId;
  } catch {
    tenantId = await publicTenant(req);
  }

  const section = await prisma.homepageSection.findUnique({
    where: { tenantId_type: { tenantId, type: 'PROMOTIONAL_BANNER' } },
  });

  if (!section) return ok({ promoCards: DEFAULT });

  const content = (section.content ?? {}) as Record<string, unknown>;
  return ok({
    promoCards: {
      enabled: section.isVisible,
      cards: Array.isArray(content.cards) ? content.cards : [],
    },
  });
});

/** PUT /api/v1/branding/promo-cards — save config. */
export const PUT = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'branding:brand:write');
  const body = promoCardsSchema.parse(await req.json().catch(() => ({})));

  const before = await prisma.homepageSection.findUnique({
    where: { tenantId_type: { tenantId: ctx.tenantId, type: 'PROMOTIONAL_BANNER' } },
  });

  const section = await prisma.homepageSection.upsert({
    where: { tenantId_type: { tenantId: ctx.tenantId, type: 'PROMOTIONAL_BANNER' } },
    update: {
      content: { cards: body.cards },
      isVisible: body.enabled,
      updatedAt: new Date(),
    },
    create: {
      tenantId: ctx.tenantId,
      type: 'PROMOTIONAL_BANNER',
      content: { cards: body.cards },
      isVisible: body.enabled,
      sortOrder: 0,
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'branding.promo_cards.updated',
    resource: 'HomepageSection',
    resourceId: section.id,
    before,
    after: section,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ promoCards: { enabled: body.enabled, cards: body.cards } });
});
