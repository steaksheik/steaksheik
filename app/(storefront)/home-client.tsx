'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { HeroConfig, PromoCard } from '@/lib/storefront';
import { useCustomer } from '@/lib/customer-context';
import {
  Flame,
  Truck,
  Clock,
  ChevronRight,
  Star,
  ShieldCheck,
  ChefHat,
  Leaf,
  CheckCircle2,
  Play,
  Handshake,
  Users,
  ShoppingBag,
  UtensilsCrossed,
  Soup,
} from 'lucide-react';

export interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  imageUrl: string | null;
}

// Design photography (marketing assets)
const IMG = {
  hero: 'https://cdn.abacus.ai/images/95644641-25bb-4a41-958a-17df20210e06.png',
  steakFries: 'https://cdn.abacus.ai/images/fd3807f8-af76-4c64-b50e-b11491e32a3f.png',
  chef: 'https://cdn.abacus.ai/images/5faadfea-ed73-4268-95eb-e301eafe8ba1.png',
  testimonial: 'https://cdn.abacus.ai/images/b747370e-f5f0-43e5-a8fa-e2cc895c8431.png',
  tbone: 'https://cdn.abacus.ai/images/d4d72b03-c191-4106-9b31-537de160a3bb.png',
  weekendPlate: 'https://cdn.abacus.ai/images/68cf5371-7416-4b2e-aa01-302b3bd01831.png',
  rChips: 'https://cdn.abacus.ai/images/02be2590-a26c-4332-b414-bc2f8d1461ab.png',
  rDessert: 'https://cdn.abacus.ai/images/a620b265-0bf5-4088-82a9-f1bf0156c6d6.png',
  rMedallions: 'https://cdn.abacus.ai/images/cd278181-c76f-4947-b406-9c488eefae45.png',
  rPlated: 'https://cdn.abacus.ai/images/34161c54-4f57-4065-809c-42316f8df04d.png',
};

const ACCENT = '#c9a96e';

// Mirrors the real tier ladder in lib/ordering/loyalty-service.ts — keep in sync if those change.
const LOYALTY_TIERS = [
  { tier: 'BRONZE', threshold: 0, img: IMG.rChips, multiplier: '1x', perk: 'Earn 10 points per £1 spent' },
  { tier: 'SILVER', threshold: 500, img: IMG.rDessert, multiplier: '1.25x', perk: 'Early access to specials' },
  { tier: 'GOLD', threshold: 1500, img: IMG.rMedallions, multiplier: '1.5x', perk: 'Free delivery on all orders' },
  { tier: 'PLATINUM', threshold: 5000, img: IMG.rPlated, multiplier: '2x', perk: 'Exclusive tasting events' },
] as const;
const MAX_TIER_THRESHOLD = LOYALTY_TIERS[LOYALTY_TIERS.length - 1].threshold;

/**
 * Hero background: renders a single image/video or an auto-advancing
 * slideshow of mixed image + video slides. Falls back to the default
 * marketing image when no slides are configured.
 */
function HeroBackground({ hero }: { hero: HeroConfig | null }) {
  const slides = hero?.slides ?? [];
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (slides.length <= 1) return;
    const ms = hero?.autoplayMs ?? 6000;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), ms);
    return () => clearInterval(t);
  }, [slides.length, hero?.autoplayMs]);

  // No configured slides → default image.
  if (slides.length === 0) {
    return (
      <>
        <img
          src={IMG.hero}
          alt="Premium grilled steak"
          className="h-full w-full object-cover object-right opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/85 to-transparent" />
      </>
    );
  }

  return (
    <>
      {slides.map((s, i) => (
        <div
          key={`${s.url}-${i}`}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === idx ? 1 : 0 }}
          aria-hidden={i === idx ? undefined : true}
        >
          {s.type === 'video' ? (
            <video
              ref={i === idx ? videoRef : undefined}
              src={s.url}
              className="h-full w-full object-cover object-center opacity-90"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.url}
              alt={s.alt ?? 'Hero slide'}
              className="h-full w-full object-cover object-right opacity-90"
            />
          )}
        </div>
      ))}
      {hero?.overlay !== false && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/85 to-transparent" />
      )}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="h-2 rounded-full transition-all"
              style={{
                width: i === idx ? 20 : 8,
                backgroundColor: i === idx ? ACCENT : 'rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function HomeClient({
  brandName,
  featured,
  featuredTitle = 'Our Most Loved Steaks',
  featuredSubtitle = null,
  hero = null,
  promoCards = [],
  rewardsEnabled = true,
}: {
  brandName: string;
  featured: StoreProduct[];
  featuredTitle?: string;
  featuredSubtitle?: string | null;
  hero?: HeroConfig | null;
  promoCards?: PromoCard[];
  rewardsEnabled?: boolean;
}) {
  const soon = (label: string) => toast.info(`${label} — coming soon`);
  const { customer } = useCustomer();
  const rewardsCta = customer
    ? { href: '/account/loyalty', label: 'View My Rewards' }
    : { href: '/account/login?mode=register&redirect=%2Faccount%2Floyalty', label: 'Join Now' };
  const [nlName, setNlName] = useState('');
  const [nlEmail, setNlEmail] = useState('');
  const [nlSubmitting, setNlSubmitting] = useState(false);

  const submitNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setNlSubmitting(true);
    try {
      const res = await fetch('/api/v1/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nlName.trim(), email: nlEmail.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Something went wrong');
      toast.success('Thanks for joining the family! We\u2019ll be in touch.');
      setNlName('');
      setNlEmail('');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to subscribe \u2014 please try again');
    } finally {
      setNlSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-[#0a0a0a]">
      {/* ══ HERO ══ */}
      <section className="relative bg-[#0a0a0a] text-white overflow-hidden">
        <div className="absolute inset-0">
          <HeroBackground hero={hero} />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
          <div className="max-w-xl">
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
              {hero?.headline ? (
                <span className="whitespace-pre-line">{hero.headline}</span>
              ) : (
                <>
                  PREMIUM STEAK.<br />
                  <span style={{ color: ACCENT }}>PERFECTLY DELIVERED.</span>
                </>
              )}
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/70 max-w-md">
              {hero?.subheadline ??
                'Restaurant quality steaks, sides and sauces delivered hot to your door.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href={hero?.ctaHref || '/menu'}
                className="inline-flex items-center gap-2 rounded-md px-7 py-3.5 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.03]"
                style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
              >
                {hero?.ctaText || 'Order Now'}
              </Link>
              <Link
                href={hero?.secondaryCtaHref || '/menu'}
                className="inline-flex items-center gap-2 rounded-md border border-white/30 px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10 transition-colors"
              >
                {hero?.secondaryCtaText || 'View Menu'}
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
              {[
                { icon: ShieldCheck, t: 'Premium Quality', s: '100% Grass-Fed' },
                { icon: Flame, t: 'Hot & Fresh', s: 'Every Time' },
                { icon: Truck, t: 'Fast Delivery', s: 'To Your Door' },
              ].map(({ icon: Icon, t, s }) => (
                <div key={t} className="flex items-center gap-2.5">
                  <Icon className="h-6 w-6 shrink-0" style={{ color: ACCENT }} />
                  <div className="leading-tight">
                    <div className="text-xs font-bold uppercase tracking-wide">{t}</div>
                    <div className="text-[11px] text-white/50">{s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ PROMO CARDS ══ */}
      {promoCards.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid gap-5 md:grid-cols-3">
            {promoCards.map((card, i) =>
              card.style === 'accent' ? (
                <div key={i} className="relative overflow-hidden rounded-xl bg-[#0a0a0a] text-white min-h-[180px] p-6 flex flex-col justify-center">
                  <h3 className="font-heading text-2xl font-extrabold leading-tight" style={{ color: ACCENT }}>{card.title}</h3>
                  {card.subtitle && <p className="mt-1 text-sm text-white/70">{card.subtitle}</p>}
                  {card.priceText && <p className="text-lg font-extrabold text-white">{card.priceText}</p>}
                  <Link href={card.ctaHref} className="mt-4 w-fit rounded-md bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#0a0a0a] hover:bg-white/90 transition-colors">{card.ctaText}</Link>
                  <Flame className="absolute right-5 bottom-4 h-20 w-20 opacity-90" style={{ color: ACCENT }} strokeWidth={1.2} />
                </div>
              ) : (
                <div key={i} className="relative overflow-hidden rounded-xl bg-[#161311] text-white min-h-[180px] flex">
                  <div className="relative z-10 p-6 flex flex-col justify-center max-w-[65%]">
                    <h3 className="font-heading text-2xl font-extrabold leading-tight">{card.title}</h3>
                    {card.subtitle && <p className="mt-1 text-sm font-bold" style={{ color: ACCENT }}>{card.subtitle}</p>}
                    {card.priceText && <p className="text-lg font-extrabold text-white">{card.priceText}</p>}
                    <Link href={card.ctaHref} className="mt-4 w-fit rounded-md bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#0a0a0a] hover:bg-white/90 transition-colors">{card.ctaText}</Link>
                  </div>
                  {card.imageUrl && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={card.imageUrl} alt={card.title} className="absolute right-0 top-0 h-full w-1/2 object-cover" />
                      <div className="absolute right-0 top-0 h-full w-3/5 bg-gradient-to-l from-transparent to-[#161311]" />
                    </>
                  )}
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* ══ REWARDS ══ */}
      {rewardsEnabled && (
      <section id="rewards" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 scroll-mt-20">
        <h2 className="font-heading text-2xl font-extrabold">EARN POINTS. GET REWARDED.</h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {LOYALTY_TIERS.map((tier) => (
              <div key={tier.tier}>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-neutral-100">
                    <img src={tier.img} alt={tier.tier} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <div className="text-lg font-extrabold leading-none">{tier.tier}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {tier.threshold === 0 ? 'From your first order' : `${tier.threshold.toLocaleString()}+ points`} · {tier.multiplier} points
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-neutral-200">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(8, (tier.threshold / MAX_TIER_THRESHOLD) * 100)}%`, backgroundColor: ACCENT }} />
                </div>
                <p className="mt-1.5 text-[11px] text-neutral-500">{tier.perk}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-[#0a0a0a] p-6 text-white flex flex-col justify-center">
            <h3 className="font-heading text-xl font-extrabold">STEAK REWARDS</h3>
            <p className="mt-2 text-sm text-white/60">
              {customer
                ? 'Check your points balance and see how close you are to your next tier.'
                : 'Earn 10 points per £1 on every order — join free and start earning today.'}
            </p>
            <Link href={rewardsCta.href} className="mt-4 w-fit rounded-md px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}>
              {rewardsCta.label}
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* ══ FEATURED PRODUCTS ══ */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="font-heading text-2xl font-extrabold">{featuredTitle.toUpperCase()}</h2>
          {featuredSubtitle && <p className="mt-1 text-sm text-neutral-500">{featuredSubtitle}</p>}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {featured.map((p) => (
              <div key={p.id} className="group overflow-hidden rounded-xl bg-[#0a0a0a] text-white">
                <Link href={`/product/${p.slug}`} className="block relative aspect-square overflow-hidden bg-neutral-900">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Flame className="h-10 w-10 text-white/10" /></div>
                  )}
                </Link>
                <div className="p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide">{p.name}</h3>
                  <p className="mt-0.5 text-sm" style={{ color: ACCENT }}>{p.price}</p>
                  <Link href={`/product/${p.slug}`} className="mt-3 block rounded-md border border-white/20 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white hover:bg-white/10 transition-colors">Order Now</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══ FEATURE CARDS ══ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { title: 'PERFECTLY COOKED', sub: 'Just the way you like it', cta: 'Learn More', href: '/#why', icon: Flame },
            { title: 'PREMIUM SIDES', sub: 'The perfect pairings', cta: 'View Sides', href: '/menu?category=sides', icon: UtensilsCrossed },
            { title: 'SIGNATURE SAUCES', sub: 'Made in-house', cta: 'View Sauces', href: '/menu', icon: Soup },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <Link key={f.title} href={f.href} className="group relative overflow-hidden rounded-xl min-h-[140px] flex items-center bg-[#0a0a0a] p-6 border border-white/5 hover:border-white/15 transition-colors">
                <Icon className="absolute -right-3 -bottom-3 h-28 w-28 opacity-[0.08] text-white" strokeWidth={1} />
                <div className="relative z-10 text-white">
                  <Icon className="h-7 w-7" style={{ color: ACCENT }} strokeWidth={1.4} />
                  <h3 className="mt-3 font-heading text-lg font-extrabold">{f.title}</h3>
                  <p className="mt-1 text-xs text-white/60">{f.sub}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
                    {f.cta} <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ══ WHY CHOOSE ══ */}
      <section id="why" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 scroll-mt-20">
        <h2 className="font-heading text-2xl font-extrabold">WHY CHOOSE {brandName.toUpperCase()}?</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { icon: ShieldCheck, t: 'Premium Quality', s: '100% grass-fed, hand selected cuts' },
            { icon: ChefHat, t: 'Expertly Cooked', s: 'Perfectly seasoned & cooked to perfection' },
            { icon: Leaf, t: 'Fresh Ingredients', s: 'Locally sourced whenever possible' },
            { icon: Truck, t: 'Fast Delivery', s: 'Delivered hot & fresh to your door' },
            { icon: CheckCircle2, t: 'Satisfaction', s: 'Not happy? We\u2019ll make it right' },
          ].map(({ icon: Icon, t, s }) => (
            <div key={t} className="flex flex-col">
              <Icon className="h-8 w-8" style={{ color: ACCENT }} strokeWidth={1.4} />
              <h3 className="mt-3 text-xs font-bold uppercase tracking-wide">{t}</h3>
              <p className="mt-1 text-xs text-neutral-500">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ DELIVERY / COLLECT ══ */}
      <section id="delivery" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 scroll-mt-20">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl bg-[#b31217] text-white min-h-[150px] p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2"><Truck className="h-5 w-5" /><h3 className="font-heading text-xl font-extrabold">DELIVERY</h3></div>
            <p className="mt-1 text-sm text-white/80">Delivered hot to you</p>
            <button onClick={() => soon('Delivery ordering')} className="mt-4 w-fit rounded-md bg-white px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#b31217] hover:bg-white/90 transition-colors">Order Delivery</button>
            <ShoppingBag className="absolute right-6 bottom-4 h-16 w-16 opacity-20" />
          </div>
          <div className="relative overflow-hidden rounded-xl text-[#0a0a0a] min-h-[150px] p-6 flex flex-col justify-center" style={{ backgroundColor: ACCENT }}>
            <div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" /><h3 className="font-heading text-xl font-extrabold">COLLECT IN STORE</h3></div>
            <p className="mt-1 text-sm text-black/70">Skip the queue</p>
            <button onClick={() => soon('Collection ordering')} className="mt-4 w-fit rounded-md bg-[#0a0a0a] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-black/90 transition-colors">Order Collection</button>
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIAL + STORY ══ */}
      <section id="story" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 scroll-mt-20">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl bg-[#0a0a0a] text-white flex">
            <img src={IMG.testimonial} alt="Customer favourite steak" className="h-auto w-2/5 object-cover" />
            <div className="p-6 flex flex-col justify-center">
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>What Our Customers Say</h3>
              <div className="mt-2 flex gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4" style={{ color: ACCENT, fill: ACCENT }} />
                ))}
              </div>
              <p className="mt-3 font-accent text-xl text-white/85 italic leading-snug">&ldquo;The best steak I&rsquo;ve had outside of a steakhouse. Always cooked perfectly and delivered hot!&rdquo;</p>
              <p className="mt-2 text-xs text-white/50">&ndash; James R.</p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl text-white min-h-[180px] flex items-center">
            <img src={IMG.tbone} alt="Our story" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0a0a0a]/70 to-[#0a0a0a]" />
            <div className="relative z-10 ml-auto p-6 text-right">
              <button onClick={() => soon('Our story video')} className="ml-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/70 hover:bg-white/10 transition-colors">
                <Play className="h-5 w-5 fill-white" />
              </button>
              <h3 className="font-heading text-xl font-extrabold">OUR STORY</h3>
              <p className="mt-1 text-sm text-white/70">Passion for steak, perfected.</p>
              <button onClick={() => soon('Our story video')} className="mt-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: ACCENT }}>Watch Video</button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ VALUES ══ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative overflow-hidden rounded-xl bg-[#0a0a0a] text-white">
          <div className="grid lg:grid-cols-[1fr_300px]">
            <div className="p-8">
              <h2 className="font-heading text-xl font-extrabold" style={{ color: ACCENT }}>WE CARE ABOUT MORE THAN JUST STEAK</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                {[
                  { icon: Leaf, t: 'Sustainable Sourcing', s: 'We work with farms that prioritise animal welfare and the environment.' },
                  { icon: Handshake, t: 'Local Partners', s: 'Supporting local farmers and suppliers in our community.' },
                  { icon: Users, t: 'Community Focus', s: 'We give back to the community through local initiatives.' },
                ].map(({ icon: Icon, t, s }) => (
                  <div key={t}>
                    <Icon className="h-7 w-7" style={{ color: ACCENT }} strokeWidth={1.4} />
                    <h3 className="mt-3 text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>{t}</h3>
                    <p className="mt-1 text-xs text-white/60">{s}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative min-h-[200px]">
              <img src={IMG.chef} alt="Our head chef" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ══ NEWSLETTER ══ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-heading text-2xl font-extrabold">JOIN THE {brandName.toUpperCase()} FAMILY</h2>
            <p className="mt-2 text-sm text-neutral-500 max-w-md">Be the first to know about new menu items, special offers and exclusive rewards.</p>
          </div>
          <form onSubmit={submitNewsletter} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={nlName}
              onChange={(e) => setNlName(e.target.value)}
              placeholder="Your name"
              className="flex-1 rounded-md border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#c9a96e] focus:ring-1 focus:ring-[#c9a96e]"
            />
            <input
              type="email"
              value={nlEmail}
              onChange={(e) => setNlEmail(e.target.value)}
              placeholder="Your email"
              className="flex-1 rounded-md border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#c9a96e] focus:ring-1 focus:ring-[#c9a96e]"
            />
            <button
              type="submit"
              disabled={nlSubmitting}
              className="rounded-md px-7 py-3 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.02] disabled:opacity-60"
              style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
            >
              {nlSubmitting ? 'Joining…' : 'Join Now'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
