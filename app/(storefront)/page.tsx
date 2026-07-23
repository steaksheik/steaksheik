import { getDefaultTenant, getBrand, getProducts, formatPrice } from '@/lib/storefront';
import { HomeClient, type StoreProduct } from './home-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const tenant = await getDefaultTenant();
  const [brand, steakProducts] = await Promise.all([
    getBrand(tenant.id),
    getProducts(tenant.id, 'steaks'),
  ]);

  const brandName = brand?.name ?? 'The Steak Sheikh';

  const steaks: StoreProduct[] = steakProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: formatPrice(Number(p.basePrice)),
    imageUrl: p.images[0]?.url ?? null,
  }));

  return <HomeClient brandName={brandName} steaks={steaks} />;
}
