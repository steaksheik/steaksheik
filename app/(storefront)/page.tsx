import { getDefaultTenant, getBrand, getContactInfo, getFeaturedProducts, getFeaturedSectionConfig, getHero, getPromoCards, formatPrice } from '@/lib/storefront';
import { getSiteUrl, jsonLdScriptProps } from '@/lib/seo';
import { HomeClient, type StoreProduct } from './home-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const tenant = await getDefaultTenant();
  const [brand, hero, featuredSection, promoCards, contactInfo] = await Promise.all([
    getBrand(tenant.id),
    getHero(tenant.id),
    getFeaturedSectionConfig(tenant.id),
    getPromoCards(tenant.id),
    getContactInfo(tenant.id),
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

  const siteUrl = getSiteUrl();
  const restaurantJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: brandName,
    url: siteUrl,
    image: brand?.logoUrl || undefined,
    menu: `${siteUrl}/menu`,
    telephone: contactInfo?.phone || undefined,
    address: contactInfo?.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: contactInfo.address,
          addressLocality: contactInfo.city || undefined,
          postalCode: contactInfo.postcode || undefined,
          addressCountry: contactInfo.country,
        }
      : undefined,
  };

  return (
    <>
      <script {...jsonLdScriptProps(restaurantJsonLd)} />
      <HomeClient
        brandName={brandName}
        featured={featured}
        featuredTitle={featuredSection.title}
        featuredSubtitle={featuredSection.subtitle}
        hero={hero}
        promoCards={promoCards}
      />
    </>
  );
}
