import { cache } from 'react';
import { prisma } from '@/lib/db';
import { get as getConfig } from '@/lib/config/service';

/**
 * Resolve the default tenant for storefront pages. Wrapped in React's
 * request-scoped cache() since both generateMetadata() and the page body
 * call this independently — without it every page would hit the DB twice.
 */
export const getDefaultTenant = cache(async () => {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) throw new Error('Default tenant not found');
  return tenant;
});

/**
 * Whether the Rewards/Loyalty feature should be shown on the storefront.
 * Defaults to enabled (matches the app's prior always-on behaviour) when no
 * admin override has been saved yet. Wrapped in cache() since the header
 * nav, homepage section, and account nav all read this independently within
 * the same request tree.
 */
export const getRewardsEnabled = cache(async (tenantId: string): Promise<boolean> => {
  const value = await getConfig<boolean>(tenantId, 'features', 'rewardsEnabled');
  return value ?? true;
});

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

export interface PromoCard {
  title: string;
  subtitle: string | null;
  priceText: string | null;
  imageUrl: string | null;
  ctaText: string;
  ctaHref: string;
  style: 'image' | 'accent';
}

// Matches what the homepage looked like before this was configurable —
// used until an admin saves their own cards via Admin -> Branding -> Promotions.
const DEFAULT_PROMO_CARDS: PromoCard[] = [
  {
    title: 'Steak Meal Deals',
    subtitle: 'SAVE UP TO 20%',
    priceText: null,
    imageUrl: 'https://cdn.abacus.ai/images/fd3807f8-af76-4c64-b50e-b11491e32a3f.png',
    ctaText: 'Order Now',
    ctaHref: '/menu',
    style: 'image',
  },
  {
    title: 'Weekend Special',
    subtitle: 'RIBEYE + 2 SIDES',
    priceText: '£24.99',
    imageUrl: 'https://cdn.abacus.ai/images/68cf5371-7416-4b2e-aa01-302b3bd01831.png',
    ctaText: 'Order Now',
    ctaHref: '/menu',
    style: 'image',
  },
  {
    title: 'Free Delivery',
    subtitle: 'ON ORDERS OVER £25',
    priceText: null,
    imageUrl: null,
    ctaText: 'Order Now',
    ctaHref: '/menu',
    style: 'accent',
  },
];

/**
 * Fetch the homepage promo cards (HomepageSection type=PROMOTIONAL_BANNER).
 * Falls back to the site's original 3 cards — now pointed at real pages
 * instead of a "coming soon" toast — until an admin customises them.
 */
export async function getPromoCards(tenantId: string): Promise<PromoCard[]> {
  const section = await prisma.homepageSection.findUnique({
    where: { tenantId_type: { tenantId, type: 'PROMOTIONAL_BANNER' } },
  });
  if (!section) return DEFAULT_PROMO_CARDS;
  if (!section.isVisible) return [];

  const c = (section.content ?? {}) as Record<string, unknown>;
  const cards = Array.isArray(c.cards) ? (c.cards as PromoCard[]) : [];
  return cards.filter((card) => card && typeof card.title === 'string' && typeof card.ctaHref === 'string');
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
export const getCategories = cache(async (tenantId: string) => {
  return prisma.category.findMany({
    where: { tenantId, status: 'ACTIVE' },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } },
  });
});

/** Fetch the tenant's public contact/address details, used for storefront structured data. */
export async function getContactInfo(tenantId: string) {
  return prisma.contactInfo.findUnique({ where: { tenantId } });
}

/** Social profile links shown in the footer, in admin-defined order. */
export async function getSocialLinks(tenantId: string) {
  return prisma.socialLink.findMany({
    where: { tenantId, isVisible: true },
    orderBy: { sortOrder: 'asc' },
    select: { platform: true, url: true },
  });
}

// ── Business hours ────────────────────────────────────────
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export interface DayHours {
  open: string;   // "16:00"
  close: string;  // "23:00"
  closed?: boolean;
}
export type BusinessHours = Partial<Record<DayKey, DayHours>>;

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

/** Shown until an admin sets real hours in Admin -> Store Location. */
export const DEFAULT_BUSINESS_HOURS: BusinessHours = DAY_KEYS.reduce<BusinessHours>((acc, day) => {
  acc[day] = { open: '16:00', close: '23:00' };
  return acc;
}, {});

function isDayHours(v: unknown): v is DayHours {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return typeof d.open === 'string' && typeof d.close === 'string';
}

/** Parse the ContactInfo.businessHours JSON blob, falling back to the default. */
export function parseBusinessHours(raw: unknown): BusinessHours {
  if (!raw || typeof raw !== 'object') return DEFAULT_BUSINESS_HOURS;
  const src = raw as Record<string, unknown>;
  const out: BusinessHours = {};
  for (const day of DAY_KEYS) {
    const v = src[day];
    if (isDayHours(v)) out[day] = { open: v.open, close: v.close, closed: Boolean((v as DayHours).closed) };
  }
  return Object.keys(out).length > 0 ? out : DEFAULT_BUSINESS_HOURS;
}

/**
 * Collapse the week into display rows, merging consecutive days that share
 * the same hours — so a uniform week reads "Mon – Sun  16:00 – 23:00"
 * rather than seven identical lines.
 */
export function formatBusinessHours(raw: unknown): { label: string; value: string }[] {
  const hours = parseBusinessHours(raw);
  const rows: { label: string; value: string }[] = [];

  let runStart: DayKey | null = null;
  let runEnd: DayKey | null = null;
  let runValue = '';

  const valueFor = (day: DayKey): string => {
    const h = hours[day];
    if (!h || h.closed) return 'Closed';
    return `${h.open} – ${h.close}`;
  };

  const flush = () => {
    if (!runStart || !runEnd) return;
    const label = runStart === runEnd ? DAY_LABELS[runStart] : `${DAY_LABELS[runStart]} – ${DAY_LABELS[runEnd]}`;
    rows.push({ label, value: runValue });
  };

  for (const day of DAY_KEYS) {
    const v = valueFor(day);
    if (runStart && v === runValue) {
      runEnd = day;
      continue;
    }
    flush();
    runStart = day;
    runEnd = day;
    runValue = v;
  }
  flush();

  return rows;
}

export interface FeaturedSectionConfig {
  enabled: boolean;
  title: string;
  subtitle: string | null;
  limit: number;
}

const DEFAULT_FEATURED_SECTION: FeaturedSectionConfig = {
  enabled: true,
  title: 'Our Most Loved Steaks',
  subtitle: null,
  limit: 5,
};

/**
 * Fetch the homepage "Featured Products" section config (HomepageSection
 * type=FEATURED_PRODUCTS). Falls back to sane defaults — matching what the
 * storefront looked like before this was configurable — when nothing has
 * been saved yet, so the section always renders something sensible.
 */
export async function getFeaturedSectionConfig(tenantId: string): Promise<FeaturedSectionConfig> {
  const section = await prisma.homepageSection.findUnique({
    where: { tenantId_type: { tenantId, type: 'FEATURED_PRODUCTS' } },
  });
  if (!section) return DEFAULT_FEATURED_SECTION;

  const c = (section.content ?? {}) as Record<string, unknown>;
  return {
    enabled: section.isVisible,
    title: section.title?.trim() || DEFAULT_FEATURED_SECTION.title,
    subtitle: section.subtitle ?? null,
    limit: typeof c.limit === 'number' && c.limit >= 2 && c.limit <= 10 ? c.limit : DEFAULT_FEATURED_SECTION.limit,
  };
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

/** Fetch published products tagged as a special (Admin -> Catalogue -> product editor). */
export async function getSpecialProducts(tenantId: string) {
  return prisma.product.findMany({
    where: { tenantId, status: 'PUBLISHED', isSpecial: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { variants: true, modifierGroups: true } },
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
export const getProductBySlug = cache(async (tenantId: string, slug: string) => {
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
});

/** Format price in GBP. */
export function formatPrice(price: number | { toNumber?: () => number }, currency = 'GBP'): string {
  const num = typeof price === 'number' ? price : (price?.toNumber?.() ?? Number(price));
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(num);
}
