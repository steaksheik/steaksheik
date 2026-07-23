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
