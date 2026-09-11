import Link from 'next/link';
import type { Metadata } from 'next';
import { getDefaultTenant, getBrand } from '@/lib/storefront';
import { getSiteUrl } from '@/lib/seo';
import { Flame } from 'lucide-react';
import { DEFAULT_BACKGROUND } from '../theme-context';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  return {
    // Root layout's title template appends "| <name>" automatically.
    title: 'Steak Guide',
    description: "How we cook your steak, and how to choose your doneness — Rare through Well-Done — before you order.",
    alternates: { canonical: `${siteUrl}/steak-guide` },
  };
}

// Matches the real "Steak Doneness" modifier group customers choose from at
// checkout (scripts/seed.ts) -- kept purely descriptive (colour/texture), no
// cook temperatures.
const DONENESS = [
  {
    name: 'Rare',
    tag: null,
    description: "A cool, deep-red centre with a well-seared crust. The meat's natural flavour, front and centre.",
  },
  {
    name: 'Medium-Rare',
    tag: 'Chef’s Recommendation',
    description: 'A warm red centre, tender and juicy edge to edge. Our most popular choice — and the one our chefs cook by default.',
  },
  {
    name: 'Medium',
    tag: null,
    description: 'A warm pink centre with a firmer bite. A balance of juiciness and a more thoroughly cooked steak.',
  },
  {
    name: 'Medium-Well',
    tag: null,
    description: 'Just a hint of pink at the very centre, mostly cooked through. Firmer texture, less juice.',
  },
  {
    name: 'Well-Done',
    tag: null,
    description: 'No pink, cooked through completely. Firm texture from edge to edge.',
  },
];

export default async function SteakGuidePage() {
  const tenant = await getDefaultTenant();
  const brand = await getBrand(tenant.id);
  const accent = brand?.theme?.accentColor ?? '#c9a96e';
  const background = brand?.theme?.backgroundColor ?? DEFAULT_BACKGROUND;
  const brandName = brand?.name || "Sonny's Sweet & Savory";

  return (
    <div className="min-h-screen" style={{ backgroundColor: background }}>
      {/* Header */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>Know Your Steak</span>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold mt-2 text-white">Steak Guide</h1>
          <p className="mt-3 text-white/40 max-w-xl">
            How we cook it, and how to choose your doneness before you order.
          </p>
        </div>
      </section>

      {/* Doneness guide */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="font-heading text-2xl font-bold text-white">Choosing Your Doneness</h2>
        <p className="mt-2 text-sm text-white/40 max-w-2xl">
          Every steak is cooked to order — pick your doneness when you order from the menu.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DONENESS.map((d) => (
            <div key={d.name} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
              {d.tag && (
                <span
                  className="inline-block mb-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: accent, color: '#0a0a0a' }}
                >
                  {d.tag}
                </span>
              )}
              <h3 className="font-heading text-lg font-extrabold text-white">{d.name}</h3>
              <p className="mt-2 text-xs text-white/50 leading-relaxed">{d.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How we cook it */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-white/5">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-8 flex flex-col sm:flex-row items-start gap-6">
          <Flame className="h-8 w-8 shrink-0" style={{ color: accent }} strokeWidth={1.4} />
          <div>
            <h2 className="font-heading text-xl font-extrabold text-white">How We Cook It</h2>
            <p className="mt-2 text-sm text-white/50 leading-relaxed max-w-2xl">
              Every steak at {brandName} is hand-cut and cooked on lava rocks — a cooking tradition as old as time
              itself, sealing in flavour while giving you full control over how your steak turns out.
            </p>
            <Link href="/wagyu-journey" className="mt-3 inline-block text-sm font-semibold" style={{ color: accent }}>
              Read the full story →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 text-center">
        <h2 className="font-heading text-2xl font-extrabold text-white">Ready to Order?</h2>
        <p className="mt-2 text-sm text-white/40">Pick your doneness at checkout — cooked exactly how you like it.</p>
        <Link
          href="/menu"
          className="mt-5 inline-flex items-center rounded-md px-6 py-3 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.03]"
          style={{ backgroundColor: accent, color: '#0a0a0a' }}
        >
          View the Menu
        </Link>
      </section>
    </div>
  );
}
