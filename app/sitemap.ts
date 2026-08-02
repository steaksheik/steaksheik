import type { MetadataRoute } from 'next';
import { getDefaultTenant, getProducts } from '@/lib/storefront';
import { getSiteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const tenant = await getDefaultTenant();
  const products = await getProducts(tenant.id);

  return [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/menu`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/wagyu-journey`, changeFrequency: 'monthly', priority: 0.7 },
    ...products.map((p) => ({
      url: `${siteUrl}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
