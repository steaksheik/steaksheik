import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/seo';
import { WagyuJourney } from '@/components/sections/WagyuJourney';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const title = 'The Ten Thousand Mile Journey | The Steak Sheikh';
  const description =
    "Sonny's story of travelling to the other side of the world to find the finest A5 full-blood Wagyu — audited first-hand, GM-free and grass-fed, just for you.";
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/wagyu-journey` },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/wagyu-journey`,
      type: 'article',
    },
  };
}

/** Full-screen cinematic hero introducing the journey. */
function JourneyHero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 text-center text-white">
      {/* Atmospheric background wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(201,169,110,0.14), transparent 65%), linear-gradient(180deg, #0a0a0a 40%, #0d0d0d 100%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-4xl">
        <p
          className="font-heading text-sm uppercase tracking-[0.45em] sm:text-base"
          style={{ color: '#c9a96e' }}
        >
          The Steak Sheikh
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
          style={{ backgroundColor: '#c9a96e' }}
          aria-hidden="true"
        />
        <p className="mt-10 animate-pulse font-heading text-xs uppercase tracking-[0.3em] text-white/40">
          Scroll to begin
        </p>
      </div>
    </section>
  );
}

export default function WagyuJourneyPage() {
  return (
    <main className="bg-[#0a0a0a]">
      <JourneyHero />
      <WagyuJourney />
    </main>
  );
}
