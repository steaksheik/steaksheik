import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDefaultTenant, getBrand, getProductBySlug, formatPrice } from '@/lib/storefront';
import { getSiteUrl, jsonLdScriptProps } from '@/lib/seo';
import { ChevronLeft, Flame } from 'lucide-react';
import { ProductConfigurator } from './product-configurator';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const tenant = await getDefaultTenant();
  const product = await getProductBySlug(tenant.id, params.slug);
  if (!product) return {};

  const siteUrl = getSiteUrl();
  const description =
    product.shortDescription || product.description || `Order ${product.name} online from The Steak Sheikh — delivery or collection.`;
  const image = product.images[0]?.url;

  return {
    title: `${product.name} | The Steak Sheikh`,
    description,
    alternates: { canonical: `${siteUrl}/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getDefaultTenant();
  const [brand, product] = await Promise.all([
    getBrand(tenant.id),
    getProductBySlug(tenant.id, params.slug),
  ]);

  if (!product) notFound();

  const accent = brand?.theme?.accentColor ?? '#c9a96e';

  // Serialize Decimal fields to numbers for client component
  const serializedVariants = product.variants.map(v => ({
    id: v.id,
    name: v.name,
    price: Number(v.price),
    isDefault: v.isDefault,
  }));

  const serializedModifiers = product.modifierGroups.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    isRequired: g.isRequired,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    modifiers: g.modifiers.map(m => ({
      id: m.id,
      name: m.name,
      priceAdjustment: Number(m.priceAdjustment),
      isDefault: m.isDefault,
    })),
  }));

  const siteUrl = getSiteUrl();
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || product.description || undefined,
    image: product.images[0]?.url ? [product.images[0].url] : undefined,
    url: `${siteUrl}/product/${product.slug}`,
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/product/${product.slug}`,
      priceCurrency: product.currency,
      price: Number(product.basePrice).toFixed(2),
      availability: product.isAvailable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <script {...jsonLdScriptProps(productJsonLd)} />
      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/menu" className="hover:text-white transition-colors flex items-center gap-1">
            <ChevronLeft className="h-3.5 w-3.5" />
            Menu
          </Link>
          <span>/</span>
          <Link
            href={`/menu?category=${product.category.slug}`}
            className="hover:text-white transition-colors"
          >
            {product.category.name}
          </Link>
          <span>/</span>
          <span className="text-white/60">{product.name}</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Image gallery */}
          <div>
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
              {product.images[0] ? (
                <img
                  src={product.images[0].url}
                  alt={product.images[0].altText ?? product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Flame className="h-16 w-16 text-white/10" />
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {product.images.slice(1, 5).map((img) => (
                  <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.06]">
                    <img src={img.url} alt={img.altText ?? ''} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div>
            <div className="mb-2">
              <span
                className="text-xs font-semibold uppercase tracking-[0.15em]"
                style={{ color: accent }}
              >
                {product.category.name}
              </span>
            </div>

            <h1 className="font-heading text-3xl sm:text-4xl font-bold">{product.name}</h1>

            {product.description && (
              <p className="mt-4 text-white/50 leading-relaxed">{product.description}</p>
            )}

            {(() => {
              const meta = (product.metadata ?? {}) as { allergens?: string[]; dietary?: string[] };
              const dietary = Array.isArray(meta.dietary) ? meta.dietary : [];
              // Prefer the structured, admin-confirmed field; fall back to the
              // legacy freeform metadata only for rows not yet backfilled.
              const allergens = product.allergens?.length ? product.allergens : (meta.allergens ?? []);
              if (!dietary.length && !allergens.length && !product.allergensConfirmed) return null;
              return (
                <div className="mt-5">
                  {dietary.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {dietary.map((d) => (
                        <span
                          key={d}
                          className="rounded-full border px-3 py-1 text-xs font-medium"
                          style={{ borderColor: `${accent}44`, color: accent }}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-white/40">
                    <span className="text-white/60">Allergens:</span>{' '}
                    {allergens.length > 0 ? allergens.join(', ') : 'None declared'}
                  </p>
                </div>
              );
            })()}

            {/* Price */}
            <div className="mt-6">
              <span className="text-3xl font-bold" style={{ color: accent }}>
                {serializedVariants.length > 0 ? 'from ' : ''}{formatPrice(product.basePrice)}
              </span>
              {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.basePrice) && (
                <span className="ml-3 text-lg text-white/30 line-through">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
            </div>

            {/* Configurator (client component for interactivity) */}
            <ProductConfigurator
              productId={product.id}
              variants={serializedVariants}
              modifierGroups={serializedModifiers}
              basePrice={Number(product.basePrice)}
              accent={accent}
              currency="GBP"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
