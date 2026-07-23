import { getDefaultTenant, getBrand, getCategories } from '@/lib/storefront';
import { StorefrontShell } from './storefront-shell';
import { StorefrontProviders } from './storefront-providers';

export const dynamic = 'force-dynamic';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getDefaultTenant();
  const brand = await getBrand(tenant.id);
  const categories = await getCategories(tenant.id);

  return (
    <StorefrontProviders>
    <StorefrontShell
      brand={brand ? {
        name: brand.name,
        tagline: brand.tagline,
        logoUrl: brand.logoUrl,
        theme: brand.theme ? {
          primaryColor: brand.theme.primaryColor,
          accentColor: brand.theme.accentColor,
          backgroundColor: brand.theme.backgroundColor,
          textColor: brand.theme.textColor,
        } : null,
      } : null}
      categories={categories.map(c => ({ name: c.name, slug: c.slug }))}
    >
      {children}
    </StorefrontShell>
    </StorefrontProviders>
  );
}
