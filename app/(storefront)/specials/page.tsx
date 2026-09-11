import Link from 'next/link';
import type { Metadata } from 'next';
import { getDefaultTenant, getBrand, getSpecialProducts, formatPrice } from '@/lib/storefront';
import { getSiteUrl } from '@/lib/seo';
import { Flame, Tag } from 'lucide-react';
import { DEFAULT_BACKGROUND } from '../theme-context';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getDefaultTenant();
  const brand = await getBrand(tenant.id);
  const siteUrl = getSiteUrl();
  const name = brand?.name || "Sonny's Sweet & Savory";

  return {
    // Root layout's title template appends "| <name>" automatically.
    title: 'Specials',
    description: `Limited-time and chef's specials from ${name} — order online for delivery or collection.`,
    alternates: { canonical: `${siteUrl}/specials` },
  };
}

export default async function SpecialsPage() {
  const tenant = await getDefaultTenant();
  const [brand, products] = await Promise.all([getBrand(tenant.id), getSpecialProducts(tenant.id)]);

  const accent = brand?.theme?.accentColor ?? '#c9a96e';
  const background = brand?.theme?.backgroundColor ?? DEFAULT_BACKGROUND;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-white/5" style={{ backgroundColor: background }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>Limited Time</span>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mt-2">Specials</h1>
          <p className="mt-3 text-white/40 max-w-xl">
            Chef&apos;s picks and promotional offers — order while they last.
          </p>
        </div>
      </section>

      {/* Product grid */}
      <section style={{ backgroundColor: background }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          {products.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const img = product.images?.[0];
                const hasVariants = (product._count?.variants ?? 0) > 0;
                const hasModifiers = (product._count?.modifierGroups ?? 0) > 0;
                const compareAt = product.compareAtPrice ? Number(product.compareAtPrice) : null;
                const onSale = compareAt !== null && compareAt > Number(product.basePrice);

                return (
                  <Link
                    key={product.id}
                    href={`/product/${product.slug}`}
                    className="group flex gap-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 p-4 transition-all hover:bg-white/[0.05]"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-24 w-24 rounded-lg bg-white/[0.02] overflow-hidden shrink-0">
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
                      <span
                        className="absolute top-1 left-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                        style={{ backgroundColor: accent, color: '#0a0a0a' }}
                      >
                        <Tag className="h-2.5 w-2.5" /> Special
                      </span>
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
                        {onSale && (
                          <span className="text-xs text-white/30 line-through">{formatPrice(compareAt!)}</span>
                        )}
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
          ) : (
            <div className="text-center py-20">
              <Tag className="h-12 w-12 mx-auto text-white/10 mb-4" />
              <p className="text-white/40">Nothing on special right now — check back soon.</p>
              <Link href="/menu" className="text-sm mt-3 inline-block" style={{ color: accent }}>Browse the full menu</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
