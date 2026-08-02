'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';

/** Brand tokens (mirrors the storefront palette used across home-client.tsx). */
const ACCENT = '#c9a96e';

export interface JourneyStep {
  /** 1-based step index, rendered as the giant faded numeral. */
  index: number;
  /** Elegant quote/title shown in Cormorant Garamond. */
  quote: string;
  /** Short supporting caption in Bebas Neue. */
  caption: string;
  /** Media source under /public/wagyu. */
  src: string;
  /** Media kind — image steps use next/image, the final step is a video. */
  type: 'image' | 'video';
  /** Alt text for images (required for accessibility). */
  alt?: string;
}

/**
 * Default 6-step Wagyu journey. Steps 1-5 are atmospheric images, step 6 is a
 * full-bleed autoplay/muted/loop video. Asset paths live in /public/wagyu and
 * any image format works — swap the file, keep the name.
 */
export const WAGYU_STEPS: JourneyStep[] = [
  {
    index: 1,
    quote:
      'I travelled to the other side of the world to find the very best beef and Wagyu — just for you.',
    caption: 'The journey begins',
    src: '/wagyu/journey-1.jpg',
    type: 'image',
    alt: 'Sonny arriving in Sydney, Australia at the start of the Wagyu journey',
  },
  {
    index: 2,
    quote: 'Dressed and ready to audit a $1M Wagyu slaughter.',
    caption: 'Behind the doors',
    src: '/wagyu/journey-2.jpg',
    type: 'image',
    alt: 'Sonny in full hygiene protective gear before entering the facility',
  },
  {
    index: 3,
    quote: 'A $1M premium Wagyu slaughter — inspected first-hand.',
    caption: 'No shortcuts',
    src: '/wagyu/journey-3.jpg',
    type: 'image',
    alt: 'Premium Wagyu carcasses hanging in the audited slaughterhouse',
  },
  {
    index: 4,
    quote: 'A5 +9 full-blood Wagyu — the pinnacle of marbling.',
    caption: 'The finest grade',
    src: '/wagyu/journey-4.jpg',
    type: 'image',
    alt: 'Close-up of A5 +9 full-blood Wagyu showing intense marbling',
  },
  {
    index: 5,
    quote: 'GM-free, grass-fed cattle — just as mother nature intended.',
    caption: 'Raised with care',
    src: '/wagyu/journey-5.jpg',
    type: 'image',
    alt: 'Grass-fed cattle grazing freely in an open Australian field',
  },
  {
    index: 6,
    quote: 'The ten thousand mile journey was ten thousand percent worth it!',
    caption: 'Taste the result',
    src: '/wagyu/journey-6.mp4',
    type: 'video',
    alt: 'Wagyu beef being sliced, revealing its marbling',
  },
];

/** Two-digit, zero-padded label e.g. 1 -> "01". */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Graceful media block: renders the step image via next/image (with a dark
 * gradient placeholder fallback if it fails to load) or a full-bleed muted
 * loop video for the final step.
 */
function StepMedia({ step }: { step: JourneyStep }) {
  const [errored, setErrored] = useState(false);

  if (step.type === 'video') {
    return (
      <div className="relative h-full w-full overflow-hidden">
        {!errored ? (
          <video
            className="h-full w-full object-cover"
            src={step.src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={step.alt}
            onError={() => setErrored(true)}
          />
        ) : (
          <MediaFallback />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-[#0a0a0a]/30" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!errored ? (
        <Image
          src={step.src}
          alt={step.alt ?? step.caption}
          fill
          sizes="(max-width: 1024px) 100vw, 55vw"
          className="object-cover"
          priority={step.index === 1}
          onError={() => setErrored(true)}
        />
      ) : (
        <MediaFallback />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-[#0a0a0a]/20 to-transparent lg:bg-gradient-to-r lg:from-[#0a0a0a]/70 lg:via-transparent lg:to-transparent" />
    </div>
  );
}

/** Dark gradient placeholder shown when an asset is missing. */
function MediaFallback() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(201,169,110,0.14), transparent 60%), linear-gradient(160deg, #141414, #0a0a0a)',
      }}
    >
      <span className="font-heading text-sm uppercase tracking-[0.3em] text-white/30">
        The Steak Sheikh
      </span>
    </div>
  );
}

/** Animated vertical gold connector suggesting the path between steps. */
function Connector() {
  const prefersReduced = useReducedMotion();
  return (
    <div className="flex justify-center py-6" aria-hidden="true">
      <motion.div
        className="relative w-px overflow-hidden"
        style={{ height: 96, backgroundColor: 'rgba(201,169,110,0.18)' }}
        initial={prefersReduced ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-40px' }}
      >
        {!prefersReduced && (
          <motion.span
            className="absolute inset-x-0 top-0 h-6"
            style={{
              background: `linear-gradient(to bottom, transparent, ${ACCENT})`,
            }}
            animate={{ y: [-24, 96] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </div>
  );
}

/** A single full-height journey step with alternating layout. */
function JourneyStepBlock({
  step,
  observe,
}: {
  step: JourneyStep;
  observe: (el: HTMLElement | null, index: number) => void;
}) {
  const prefersReduced = useReducedMotion();
  const imageLeft = step.index % 2 === 1; // odd steps: image left, text right

  const mediaVariants = {
    hidden: { opacity: 0, scale: 1.06 },
    show: { opacity: 1, scale: 1 },
  };
  const textVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <section
      ref={(el) => observe(el, step.index)}
      aria-label={`Step ${step.index}: ${step.caption}`}
      className="relative flex min-h-[85vh] w-full items-stretch py-8 lg:min-h-screen lg:py-0"
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">
        {/* Media */}
        <motion.div
          className={`relative h-[52vh] overflow-hidden rounded-xl lg:h-[76vh] ${
            imageLeft ? 'lg:order-1' : 'lg:order-2'
          }`}
          style={{ boxShadow: '0 30px 80px -30px rgba(0,0,0,0.9)' }}
          variants={mediaVariants}
          initial={prefersReduced ? false : 'hidden'}
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          <StepMedia step={step} />
        </motion.div>

        {/* Text */}
        <div
          className={`relative flex flex-col justify-center ${
            imageLeft ? 'lg:order-2' : 'lg:order-1'
          }`}
        >
          {/* Giant faded background numeral */}
          <span
            aria-hidden="true"
            className="pointer-events-none select-none font-heading leading-none text-[28vw] lg:text-[16vw]"
            style={{
              position: 'absolute',
              top: '-0.35em',
              left: imageLeft ? 'auto' : '-0.04em',
              right: imageLeft ? '-0.04em' : 'auto',
              color: 'rgba(201,169,110,0.07)',
              zIndex: 0,
            }}
          >
            {pad(step.index)}
          </span>

          <motion.div
            className="relative z-10"
            variants={textVariants}
            initial={prefersReduced ? false : 'hidden'}
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className="font-heading text-xl tracking-wider"
                style={{ color: ACCENT }}
              >
                {pad(step.index)}
              </span>
              <span className="h-px w-12" style={{ backgroundColor: ACCENT }} />
              <span className="font-heading text-xs uppercase tracking-[0.35em] text-white/60">
                {step.caption}
              </span>
            </div>
            <p className="font-accent text-3xl font-medium leading-tight text-white sm:text-4xl lg:text-5xl">
              {step.quote}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * WagyuJourney — a full immersive, scroll-driven 6-step experience with a
 * sticky floating step counter, alternating layouts, animated connectors and
 * a closing "Taste the Journey" CTA.
 */
export function WagyuJourney({
  steps = WAGYU_STEPS,
}: {
  steps?: JourneyStep[];
}) {
  const [active, setActive] = useState(1);
  const total = steps.length;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the most visible step currently intersecting the viewport.
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number(
            (entry.target as HTMLElement).dataset.stepIndex ?? '0'
          );
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index, ratio: entry.intersectionRatio };
          }
        }
        if (best) setActive(best.index);
      },
      { threshold: [0.2, 0.4, 0.6, 0.8], rootMargin: '-10% 0px -10% 0px' }
    );
    observerRef.current = observer;
    elementsRef.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [steps]);

  const observe = (el: HTMLElement | null, index: number) => {
    if (!el) return;
    el.dataset.stepIndex = String(index);
    elementsRef.current.set(index, el);
    observerRef.current?.observe(el);
  };

  return (
    <div className="relative bg-[#0a0a0a] text-white">
      {/* Sticky floating step counter */}
      <div
        className="pointer-events-none fixed right-4 top-24 z-40 sm:right-8"
        aria-hidden="true"
      >
        <div className="flex items-baseline gap-1 rounded-full border border-white/10 bg-[#0a0a0a]/70 px-4 py-2 backdrop-blur-md">
          <span
            className="font-heading text-xl leading-none"
            style={{ color: ACCENT }}
          >
            {pad(active)}
          </span>
          <span className="font-heading text-sm leading-none text-white/40">
            / {pad(total)}
          </span>
        </div>
      </div>

      {/* Steps with connectors between them */}
      {steps.map((step, i) => (
        <div key={step.index}>
          <JourneyStepBlock step={step} observe={observe} />
          {i < steps.length - 1 && <Connector />}
        </div>
      ))}

      {/* Closing CTA */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-24 text-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(201,169,110,0.16), transparent 70%)',
          }}
        />
        <motion.div
          className="relative z-10 mx-auto max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <p
            className="font-heading text-sm uppercase tracking-[0.4em]"
            style={{ color: ACCENT }}
          >
            Ten thousand miles
          </p>
          <h2 className="mt-4 font-heading text-5xl uppercase leading-none tracking-tight sm:text-6xl lg:text-7xl">
            Taste the Journey
          </h2>
          <p className="mx-auto mt-5 max-w-md font-accent text-xl text-white/70">
            Every mile, every audit, every grade of marbling — delivered to your
            door.
          </p>
          <Link
            href="/menu"
            className="mt-8 inline-flex items-center gap-2 rounded-md px-8 py-3.5 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
          >
            View the Menu
          </Link>
        </motion.div>
      </section>
    </div>
  );
}

export default WagyuJourney;
