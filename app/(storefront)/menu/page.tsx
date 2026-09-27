import Link from 'next/link';
import type { Metadata } from 'next';
import { getDefaultTenant, getBrand, getCategories, getProducts, formatPrice } from '@/lib/storefront';
import { getSiteUrl } from '@/lib/seo';
import { Flame } from 'lucide-react';
import { MenuCategoryFilter } from './menu-filter';
import { DEFAULT_BACKGROUND, DEFAULT_SECONDARY } from '../theme-context';
import { surfaceTokens } from '@/lib/theme/colors';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { category?: string };
}): Promise<Metadata> {
  const tenant = await getDefaultTenant();
  const [brand, categories] = await Promise.all([getBrand(tenant.id), getCategories(tenant.id)]);
  const active = categories.find((c) => c.slug === searchParams.category);
  const siteUrl = getSiteUrl();
  const name = brand?.name || "Sonny's Sweet & Savory";

  return {
    // Root layout's title template appends "| <name>" automatically.
    title: active ? `${active.name} Menu` : 'Menu',
    description: active
      ? `Order ${active.name} online from ${name} — halal steaks, burgers and sides for delivery or collection.`
      : `Browse the full ${name} menu — halal steaks, signature burgers and sides. Order online for delivery or collection.`,
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
  const background = brand?.theme?.backgroundColor ?? DEFAULT_BACKGROUND;
  const cardBg = brand?.theme?.secondaryColor ?? DEFAULT_SECONDARY;
  // Text and hairlines are derived from whichever surface they sit on, so the
  // page stays legible whatever colours are set in Admin -> Branding.
  const page = surfaceTokens(background);
  const card = surfaceTokens(cardBg);

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
      <section className="border-b" style={{ backgroundColor: background, borderColor: page.border, color: page.text }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>Our Menu</span>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mt-2">What We Serve</h1>
          <p className="mt-3 max-w-xl" style={{ color: page.muted }}>
            Every dish crafted with passion. Premium ingredients, zero compromise.
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="sticky top-[92px] sm:top-[104px] z-40 backdrop-blur-md border-b" style={{ backgroundColor: `${background}f2`, borderColor: page.border, color: page.text }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <MenuCategoryFilter categories={categories.map(c => ({ name: c.name, slug: c.slug }))} activeSlug={activeSlug} accent={accent} />
        </div>
      </section>

      {/* Product grid */}
      <section style={{ backgroundColor: background, color: page.text }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          {grouped.map((group) => (
            group.products.length > 0 && (
              <div key={group.id ?? group.slug} className="mb-14 last:mb-0">
                {!activeSlug && (
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="font-heading text-2xl font-bold">{group.name}</h2>
                    <div className="h-px flex-1" style={{ backgroundColor: page.border }} />
                    <span className="text-xs" style={{ color: page.faint }}>{group.products.length} items</span>
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
                        className="group flex gap-4 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:opacity-95"
                        style={{ backgroundColor: cardBg, borderColor: card.border, color: card.text }}
                      >
                        {/* Thumbnail */}
                        <div className="h-24 w-24 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: card.subtle }}>
                          {img ? (
                            <img
                              src={img.url}
                              alt={img.altText ?? product.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Flame className="h-6 w-6" style={{ color: card.faint }} />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[15px] group-hover:opacity-80 transition-opacity truncate">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="mt-1 text-xs line-clamp-2" style={{ color: card.muted }}>{product.description}</p>
                          )}
                          <div className="mt-2.5 flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: accent }}>
                              {hasVariants ? 'from ' : ''}{formatPrice(product.basePrice)}
                            </span>
                            {hasModifiers && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: card.subtle, color: card.muted }}>
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
              <Flame className="h-12 w-12 mx-auto mb-4" style={{ color: page.faint }} />
              <p style={{ color: page.muted }}>No items found in this category.</p>
              <Link href="/menu" className="text-sm mt-3 inline-block" style={{ color: accent }}>View all menu items</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
