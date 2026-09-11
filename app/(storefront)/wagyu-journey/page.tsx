import type { Metadata } from 'next';
import Image from 'next/image';
import { getSiteUrl } from '@/lib/seo';
import { getDefaultTenant, getBrand } from '@/lib/storefront';
import { DEFAULT_ACCENT, DEFAULT_BACKGROUND } from '../theme-context';
import { WagyuJourney } from '@/components/sections/WagyuJourney';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getDefaultTenant();
  const brand = await getBrand(tenant.id);
  const name = brand?.name || "Sonny's Sweet & Savory";
  const siteUrl = getSiteUrl();
  const shortTitle = 'The Ten Thousand Mile Journey';
  const description =
    "Sonny's story of travelling to the other side of the world to find the finest A5 full-blood Wagyu — audited first-hand, GM-free and grass-fed, just for you.";
  return {
    // Root layout's title template appends "| <name>" automatically.
    title: shortTitle,
    description,
    alternates: { canonical: `${siteUrl}/wagyu-journey` },
    openGraph: {
      title: `${shortTitle} | ${name}`,
      description,
      url: `${siteUrl}/wagyu-journey`,
      type: 'article',
    },
  };
}

/** Full-screen cinematic hero introducing the journey. */
function JourneyHero({ accent, background, brandName }: { accent: string; background: string; brandName: string }) {
  return (
    <section
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 text-center text-white"
      style={{ backgroundColor: background }}
    >
      {/* Atmospheric background wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 30%, rgba(201,169,110,0.14), transparent 65%), ${background}`,
        }}
      />
      <div className="relative z-10 mx-auto max-w-4xl">
        <p
          className="font-heading text-sm uppercase tracking-[0.45em] sm:text-base"
          style={{ color: accent }}
        >
          {brandName}
        </p>
        <h1 className="mt-6 font-heading text-6xl uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl xl:text-9xl">
          The Ten Thousand
          <br />
          Mile Journey
        </h1>
        <p className="mx-auto mt-8 max-w-xl font-accent text-xl italic text-white/70 sm:text-2xl">
          Sonny&apos;s story of finding the world&apos;s finest Wagyu.
        </p>
        <div
          className="mx-auto mt-10 h-px w-24"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <p className="mt-10 animate-pulse font-heading text-xs uppercase tracking-[0.3em] text-white/40">
          Scroll to begin
        </p>
      </div>
    </section>
  );
}

/**
 * Sonny's founder story — the personal introduction that sets up the journey.
 * Portrait on the right, "Steak Perfection" letter on the left.
 */
function SonnyStory({ accent, background, brandName }: { accent: string; background: string; brandName: string }) {
  return (
    <section className="relative overflow-hidden py-16 text-white sm:py-24" style={{ backgroundColor: background }}>
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* Letter */}
        <div className="order-2 lg:order-1">
          <p
            className="font-heading text-sm uppercase tracking-[0.4em]"
            style={{ color: accent }}
          >
            Simply Irresistible
          </p>
          <h2 className="mt-4 font-accent text-6xl font-medium uppercase leading-[0.95] tracking-tight sm:text-7xl">
            Steak
            <br />
            Perfection
          </h2>

          <div className="mt-8 space-y-4 text-base leading-relaxed text-white/70 sm:text-lg">
            <p>
              Welcome to {brandName}, the home of the finest hand-selected,
              free-range, organic grass-fed beef and meats served in the British
              Isles, cooked on lava rocks in a cooking tradition as old as time
              itself.
            </p>
            <p>
              I personally have travelled the world to source for you the
              unrivalled Wagyu and beef cuts on offer to you today.
            </p>
            <p>
              My love for the world&apos;s finest beef is shared by my dedicated
              team of passionate chefs who will carefully hand-select your chosen
              steak, and by our enthusiastic front-of-house team, who are here to
              help you get the very best from the rock and your personal Sonny&apos;s
              adventure.
            </p>
            <p>
              My late father&apos;s mantra drummed into me four decades ago when I
              started out as a kitchen hand was and remains to this day:
            </p>
            <p
              className="font-accent text-2xl italic sm:text-3xl"
              style={{ color: accent }}
            >
              &lsquo;Made with Love&rsquo;
            </p>
            <p>Welcome to {brandName}, Welcome to Steak.</p>
          </div>

          <div className="mt-8">
            <p className="font-accent text-2xl font-semibold italic text-white">
              Sonny
            </p>
            <p className="text-sm text-white/60">Executive Chef &amp; Founder</p>
          </div>
        </div>

        {/* Portrait */}
        <div className="order-1 lg:order-2">
          <div
            className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl lg:max-w-none"
            style={{ boxShadow: '0 30px 80px -30px rgba(0,0,0,0.9)' }}
          >
            <Image
              src="/sonny-steak-sheikh.jpg"
              alt={`Sonny — Executive Chef & Founder, ${brandName}`}
              fill
              sizes="(max-width: 1024px) 90vw, 45vw"
              className="object-cover object-top"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function WagyuJourneyPage() {
  const tenant = await getDefaultTenant();
  const brand = await getBrand(tenant.id);
  const accent = brand?.theme?.accentColor ?? DEFAULT_ACCENT;
  const background = brand?.theme?.backgroundColor ?? DEFAULT_BACKGROUND;
  const brandName = brand?.name || "Sonny's Sweet & Savory";

  return (
    <main style={{ backgroundColor: background }}>
      <JourneyHero accent={accent} background={background} brandName={brandName} />
      <SonnyStory accent={accent} background={background} brandName={brandName} />
      <WagyuJourney />
    </main>
  );
}
