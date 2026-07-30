import Link from 'next/link';
import type { Metadata } from 'next';
import { getDefaultTenant, getBrand, getCategories, getProducts, formatPrice } from '@/lib/storefront';
import { getSiteUrl } from '@/lib/seo';
import { Flame } from 'lucide-react';
import { MenuCategoryFilter } from './menu-filter';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { category?: string };
}): Promise<Metadata> {
  const tenant = await getDefaultTenant();
  const categories = await getCategories(tenant.id);
  const active = categories.find((c) => c.slug === searchParams.category);
  const siteUrl = getSiteUrl();

  return {
    title: active ? `${active.name} | The Steak Sheikh Menu` : 'Menu | The Steak Sheikh',
    description: active
      ? `Order ${active.name} online from The Steak Sheikh — halal steaks, burgers and sides for delivery or collection.`
      : 'Browse the full Steak Sheikh menu — halal steaks, signature burgers and sides. Order online for delivery or collection.',
    // Category filtering happens client-side off the same URL family — point
    // every variant at the canonical /menu so Google consolidates them
    // instead of treating each ?category= as a separate near-duplicate page.
    alternates: { canonical: `${siteUrl}/menu` },
  };
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const tenant = await getDefaultTenant();
  const activeSlug = searchParams.category ?? '';

  const [brand, categories, products] = await Promise.all([
    getBrand(tenant.id),
    getCategories(tenant.id),
    getProducts(tenant.id, activeSlug || undefined),
  ]);

  const accent = brand?.theme?.accentColor ?? '#c9a96e';

  // Group products by category for display
  const grouped = !activeSlug
    ? categories.map((cat) => ({
        ...cat,
        products: products.filter((p) => p.categoryId === cat.id),
      }))
    : [{ id: 'filtered', name: categories.find(c => c.slug === activeSlug)?.name ?? 'Menu', slug: activeSlug, products }];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-[#0a0a0a] border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>Our Menu</span>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mt-2">What We Serve</h1>
          <p className="mt-3 text-white/40 max-w-xl">
            Every dish crafted with passion. Premium ingredients, zero compromise.
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="sticky top-16 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <MenuCategoryFilter categories={categories.map(c => ({ name: c.name, slug: c.slug }))} activeSlug={activeSlug} accent={accent} />
        </div>
      </section>

      {/* Product grid */}
      <section className="bg-[#0a0a0a]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          {grouped.map((group) => (
            group.products.length > 0 && (
              <div key={group.id ?? group.slug} className="mb-14 last:mb-0">
                {!activeSlug && (
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="font-heading text-2xl font-bold">{group.name}</h2>
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs text-white/30">{group.products.length} items</span>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.products.map((product) => {
                    const img = product.images?.[0];
                    const hasVariants = (product._count?.variants ?? 0) > 0;
                    const hasModifiers = (product._count?.modifierGroups ?? 0) > 0;

                    return (
                      <Link
                        key={product.id}
                        href={`/product/${product.slug}`}
                        className="group flex gap-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 p-4 transition-all hover:bg-white/[0.05]"
                      >
                        {/* Thumbnail */}
                        <div className="h-24 w-24 rounded-lg bg-white/[0.02] overflow-hidden shrink-0">
                          {img ? (
                            <img
                              src={img.url}
                              alt={img.altText ?? product.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Flame className="h-6 w-6 text-white/10" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[15px] group-hover:opacity-80 transition-opacity truncate">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="mt-1 text-xs text-white/40 line-clamp-2">{product.description}</p>
                          )}
                          <div className="mt-2.5 flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: accent }}>
                              {hasVariants ? 'from ' : ''}{formatPrice(product.basePrice)}
                            </span>
                            {hasModifiers && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/40">
                                customisable
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )
          ))}

          {products.length === 0 && (
            <div className="text-center py-20">
              <Flame className="h-12 w-12 mx-auto text-white/10 mb-4" />
              <p className="text-white/40">No items found in this category.</p>
              <Link href="/menu" className="text-sm mt-3 inline-block" style={{ color: accent }}>View all menu items</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
