import { prisma } from '@/lib/db';

/** Resolve the default tenant for storefront pages. */
export async function getDefaultTenant() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) throw new Error('Default tenant not found');
  return tenant;
}

/** Fetch brand + theme for storefront. */
export async function getBrand(tenantId: string) {
  return prisma.brand.findFirst({
    where: { tenantId },
    include: { theme: true, assets: true },
  });
}

export interface HeroSlide {
  type: 'image' | 'video';
  url: string;
  alt?: string | null;
}
export interface HeroConfig {
  enabled: boolean;
  slides: HeroSlide[];
  autoplayMs: number;
  headline?: string | null;
  subheadline?: string | null;
  ctaText?: string | null;
  ctaHref?: string | null;
  secondaryCtaText?: string | null;
  secondaryCtaHref?: string | null;
  overlay: boolean;
}

/**
 * Fetch the storefront hero configuration (HomepageSection type=HERO).
 * Returns null when no hero has been configured yet — the storefront then
 * falls back to its built-in default hero.
 */
export async function getHero(tenantId: string): Promise<HeroConfig | null> {
  const section = await prisma.homepageSection.findUnique({
    where: { tenantId_type: { tenantId, type: 'HERO' } },
  });
  if (!section || !section.isVisible) return null;

  const c = (section.content ?? {}) as Record<string, unknown>;
  const slides = Array.isArray(c.slides)
    ? (c.slides as HeroSlide[]).filter(
        (s) => s && (s.type === 'image' || s.type === 'video') && typeof s.url === 'string',
      )
    : [];
  if (slides.length === 0) return null;

  return {
    enabled: true,
    slides,
    autoplayMs: typeof c.autoplayMs === 'number' ? c.autoplayMs : 6000,
    headline: (c.headline as string) ?? null,
    subheadline: (c.subheadline as string) ?? null,
    ctaText: (c.ctaText as string) ?? null,
    ctaHref: (c.ctaHref as string) ?? null,
    secondaryCtaText: (c.secondaryCtaText as string) ?? null,
    secondaryCtaHref: (c.secondaryCtaHref as string) ?? null,
    overlay: c.overlay !== false,
  };
}

export interface PublicAnalyticsConfig {
  ga4MeasurementId: string | null;
  gtmContainerId: string | null;
}

/**
 * Fetch GA4/GTM IDs for enabled analytics services so the storefront can
 * inject the real tracking scripts. Both fields are plain (non-secret)
 * config values, not encrypted credentials.
 */
export async function getPublicAnalyticsConfig(tenantId: string): Promise<PublicAnalyticsConfig> {
  try {
    const services = await prisma.platformService.findMany({
      where: {
        tenantId,
        serviceType: { in: ['ANALYTICS_GA4', 'ANALYTICS_GTM'] as never },
        isEnabled: true,
      },
    });
    const ga4 = services.find((s) => s.serviceType === ('ANALYTICS_GA4' as never));
    const gtm = services.find((s) => s.serviceType === ('ANALYTICS_GTM' as never));
    const measurementId = (ga4?.config as Record<string, unknown> | null)?.measurementId as string;
    const containerId = (gtm?.config as Record<string, unknown> | null)?.containerId as string;
    // These IDs are interpolated directly into inline <script> tags below —
    // validate the format so a malformed saved value can't break out of it.
    return {
      ga4MeasurementId: measurementId && /^G-[A-Z0-9]{6,}$/i.test(measurementId) ? measurementId : null,
      gtmContainerId: containerId && /^GTM-[A-Z0-9]{5,}$/i.test(containerId) ? containerId : null,
    };
  } catch {
    return { ga4MeasurementId: null, gtmContainerId: null };
  }
}

/** Fetch all active categories with product count. */
export async function getCategories(tenantId: string) {
  return prisma.category.findMany({
    where: { tenantId, status: 'ACTIVE' },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } },
  });
}

/** Fetch featured published products. */
export async function getFeaturedProducts(tenantId: string, limit = 6) {
  return prisma.product.findMany({
    where: { tenantId, status: 'PUBLISHED', isFeatured: true },
    orderBy: { sortOrder: 'asc' },
    take: limit,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { where: { isPrimary: true }, take: 1 },
    },
  });
}

/** Fetch published products, optionally filtered by category slug. */
export async function getProducts(tenantId: string, categorySlug?: string) {
  const where: Record<string, unknown> = { tenantId, status: 'PUBLISHED' };
  if (categorySlug) {
    const cat = await prisma.category.findFirst({ where: { tenantId, slug: categorySlug } });
    if (cat) where.categoryId = cat.id;
  }
  return prisma.product.findMany({
    where: where as never,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { variants: true, modifierGroups: true } },
    },
  });
}

/** Fetch a single product by slug with full details. */
export async function getProductBySlug(tenantId: string, slug: string) {
  return prisma.product.findFirst({
    where: { tenantId, slug, status: 'PUBLISHED' },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { where: { isAvailable: true }, orderBy: { sortOrder: 'asc' } },
      modifierGroups: {
        orderBy: { sortOrder: 'asc' },
        include: { modifiers: { where: { isAvailable: true }, orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
}

/** Format price in GBP. */
export function formatPrice(price: number | { toNumber?: () => number }, currency = 'GBP'): string {
  const num = typeof price === 'number' ? price : (price?.toNumber?.() ?? Number(price));
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(num);
}
