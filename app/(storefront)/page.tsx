import { getDefaultTenant, getBrand, getFeaturedProducts, getFeaturedSectionConfig, getHero, formatPrice } from '@/lib/storefront';
import { HomeClient, type StoreProduct } from './home-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const tenant = await getDefaultTenant();
  const [brand, hero, featuredSection] = await Promise.all([
    getBrand(tenant.id),
    getHero(tenant.id),
    getFeaturedSectionConfig(tenant.id),
  ]);

  const featuredProducts = featuredSection.enabled
    ? await getFeaturedProducts(tenant.id, featuredSection.limit)
    : [];

  const brandName = brand?.name ?? 'The Steak Sheikh';

  const featured: StoreProduct[] = featuredProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: formatPrice(Number(p.basePrice)),
    imageUrl: p.images[0]?.url ?? null,
  }));

  return (
    <HomeClient
      brandName={brandName}
      featured={featured}
      featuredTitle={featuredSection.title}
      featuredSubtitle={featuredSection.subtitle}
      hero={hero}
    />
  );
}
