'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useCart } from '@/lib/cart-context';
import { useCustomer } from '@/lib/customer-context';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Menu,
  X,
  Flame,
  Search,
  User,
  ShoppingBag,
  ChevronDown,
  Facebook,
  Instagram,
  Music2,
  Apple,
  Play,
  Share,
  SquarePlus,
  Check,
} from 'lucide-react';

interface BrandInfo {
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  theme: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  } | null;
}

interface NavCategory {
  name: string;
  slug: string;
}

const ACCENT = '#c9a96e';

export function StorefrontShell({
  brand,
  categories,
  children,
}: {
  brand: BrandInfo | null;
  categories: NavCategory[];
  children: React.ReactNode;
}) {
    const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [iosInstallOpen, setIosInstallOpen] = useState(false);
  const name = (brand?.name ?? 'The Steak Sheikh').toUpperCase();
  const accent = brand?.theme?.accentColor ?? ACCENT;
  const pwaInstall = usePwaInstall();

  const soon = (label: string) => toast.info(`${label} -- coming soon`);

  async function handleAppStoreClick() {
    // No native iOS app exists — this is the PWA install path. iOS Safari has
    // no programmatic install prompt, so guide the user through the manual
    // "Share -> Add to Home Screen" flow instead.
    if (pwaInstall.isIOS) {
      setIosInstallOpen(true);
      return;
    }
    if (pwaInstall.canPrompt) {
      const outcome = await pwaInstall.promptInstall();
      if (outcome === 'accepted') toast.success('App installed!');
      return;
    }
    toast.info(pwaInstall.installed ? 'Already installed' : 'Open this site in Safari on your iPhone/iPad to install it');
  }

  async function handleGooglePlayClick() {
    if (pwaInstall.canPrompt) {
      const outcome = await pwaInstall.promptInstall();
      if (outcome === 'accepted') toast.success('App installed!');
      return;
    }
    if (pwaInstall.installed) {
      toast.info('Already installed');
      return;
    }
    toast.info('Use your browser menu and choose "Install app" or "Add to Home screen"');
  }

  const Logo = (
    <Link href="/" className="flex items-center gap-2.5 group">
      {brand?.logoUrl ? (
        <img
          src={brand.logoUrl}
          alt={brand.name ?? 'The Steak Sheikh'}
          className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover"
        />
      ) : (
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: accent }}
        >
          <Flame className="h-5 w-5" style={{ color: '#0a0a0a' }} />
        </span>
      )}
      <span className="leading-none">
        <span className="block font-heading text-lg font-extrabold tracking-tight text-white">
          {name}
        </span>
        {brand?.tagline && (
          <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {brand.tagline}
          </span>
        )}
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] sm:h-[84px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {Logo}

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7">
            <div className="relative" onMouseLeave={() => setMenuOpen(false)}>
              <button
                onMouseEnter={() => setMenuOpen(true)}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wide text-white/80 hover:text-white transition-colors"
              >
                Menu <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute left-0 top-full pt-3">
                  <div className="w-52 rounded-lg border border-white/10 bg-[#141414] py-2 shadow-xl shadow-black/40">
                    <Link href="/menu" className="block px-4 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white">
                      Full Menu
                    </Link>
                    {categories.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/menu?category=${c.slug}`}
                        className="block px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Link href="/menu?category=steaks" className="text-[13px] font-semibold uppercase tracking-wide text-white/80 hover:text-white transition-colors">
              Specials
            </Link>
            <Link href="/#why" className="text-[13px] font-semibold uppercase tracking-wide text-white/80 hover:text-white transition-colors">
              Steak Guide
            </Link>
            <Link href="/#rewards" className="text-[13px] font-semibold uppercase tracking-wide text-white/80 hover:text-white transition-colors">
              Rewards
            </Link>
            <Link href="/#story" className="text-[13px] font-semibold uppercase tracking-wide text-white/80 hover:text-white transition-colors">
              Our Story
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => soon('Search')} aria-label="Search" className="hidden sm:inline-flex p-2 text-white/70 hover:text-white transition-colors">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <AccountButton />
            <CartButton accent={accent} />
            <Link
              href="/menu"
              className="ml-1 hidden sm:inline-flex items-center rounded-md px-4 py-2 text-[12px] font-bold uppercase tracking-wide transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: accent, color: '#0a0a0a' }}
            >
              Order Now
            </Link>
            <button
              className="lg:hidden p-2 text-white/70 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-white/10 bg-[#0a0a0a] px-4 py-4 space-y-1">
            <Link href="/menu" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">Full Menu</Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/menu?category=${c.slug}`}
                onClick={() => setMobileOpen(false)}
                className="block py-2.5 text-sm text-white/60 hover:text-white pl-3"
              >
                {c.name}
              </Link>
            ))}
            <Link href="/#rewards" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">Rewards</Link>
            <Link href="/#story" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">Our Story</Link>
            <Link
              href="/menu"
              onClick={() => setMobileOpen(false)}
              className="mt-2 block rounded-md px-4 py-2.5 text-center text-sm font-bold uppercase tracking-wide"
              style={{ backgroundColor: accent, color: '#0a0a0a' }}
            >
              Order Now
            </Link>
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 bg-[#0a0a0a]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid gap-10 md:grid-cols-5">
            {/* Brand */}
            <div className="md:col-span-1">
              {Logo}
              {brand?.tagline && (
                <p className="mt-4 text-sm text-white/45 max-w-[200px]">{brand.tagline}</p>
              )}
              <div className="mt-5 flex items-center gap-2">
                <button onClick={() => soon('Facebook')} aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                  <Facebook className="h-4 w-4" />
                </button>
                <button onClick={() => soon('Instagram')} aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                  <Instagram className="h-4 w-4" />
                </button>
                <button onClick={() => soon('TikTok')} aria-label="TikTok" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                  <Music2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Menu */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-4">Menu</h4>
              <ul className="space-y-2.5">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/menu?category=${c.slug}`} className="text-sm text-white/50 hover:text-white transition-colors">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Information */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-4">Information</h4>
              <ul className="space-y-2.5">
                <li><Link href="/#story" className="text-sm text-white/50 hover:text-white transition-colors">Our Story</Link></li>
                <li><Link href="/#why" className="text-sm text-white/50 hover:text-white transition-colors">Steak Guide</Link></li>
                <li><Link href="/#rewards" className="text-sm text-white/50 hover:text-white transition-colors">Rewards</Link></li>
                <li><Link href="/menu" className="text-sm text-white/50 hover:text-white transition-colors">Full Menu</Link></li>
              </ul>
            </div>

            {/* Customer Service */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-4">Customer Service</h4>
              <ul className="space-y-2.5">
                <li><Link href="/#delivery" className="text-sm text-white/50 hover:text-white transition-colors">Delivery Info</Link></li>
                <li><Link href="/#delivery" className="text-sm text-white/50 hover:text-white transition-colors">Collection</Link></li>
                <li><a href="mailto:steaksheikh4@gmail.com" className="text-sm text-white/50 hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-4">Contact</h4>
              <ul className="space-y-2.5 text-sm text-white/50">
                <li><a href="mailto:steaksheikh4@gmail.com" className="hover:text-white transition-colors">steaksheikh4@gmail.com</a></li>
                <li><a href="tel:+441234567890" className="hover:text-white transition-colors">0123 456 7890</a></li>
                <li>9:00 &ndash; 23:00 Daily</li>
              </ul>
                           <div className="mt-4 flex flex-col gap-2">
                {pwaInstall.installed ? (
                  <div className="inline-flex w-[140px] items-center gap-2 rounded-md border border-white/15 bg-black px-3 py-1.5 text-white/70">
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span className="text-[11px]">App installed</span>
                  </div>
                ) : (
                  <>
                    <button onClick={handleAppStoreClick} className="inline-flex w-[140px] items-center gap-2 rounded-md border border-white/15 bg-black px-3 py-1.5 text-white hover:bg-white/5 transition-colors">
                      <Apple className="h-5 w-5" />
                      <span className="leading-none text-left"><span className="block text-[8px] text-white/60">Install for</span><span className="block text-[12px] font-semibold">iPhone</span></span>
                    </button>
                    <button onClick={handleGooglePlayClick} className="inline-flex w-[140px] items-center gap-2 rounded-md border border-white/15 bg-black px-3 py-1.5 text-white hover:bg-white/5 transition-colors">
                      <Play className="h-4 w-4" />
                      <span className="leading-none text-left"><span className="block text-[8px] text-white/60">Install for</span><span className="block text-[12px] font-semibold">Android</span></span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/10 text-center text-xs text-white/30">
            &copy; {new Date().getFullYear()} {brand?.name ?? 'The Steak Sheikh'}. All rights reserved.
          </div>
               </div>
      </footer>

      {/* iOS has no programmatic install prompt — walk the user through it manually. */}
      <Dialog open={iosInstallOpen} onOpenChange={setIosInstallOpen}>
        <DialogContent className="max-w-sm bg-[#0a0a0a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Install on your iPhone</DialogTitle>
          </DialogHeader>
          <ol className="space-y-4 text-sm text-white/70 py-2">
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">1</span>
              <span className="flex items-center gap-1.5">Tap the Share button <Share className="h-4 w-4 inline text-white" /> in Safari's toolbar</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">2</span>
              <span className="flex items-center gap-1.5">Scroll down and tap <SquarePlus className="h-4 w-4 inline text-white" /> <span className="font-medium text-white">Add to Home Screen</span></span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">3</span>
              <span>Tap <span className="font-medium text-white">Add</span> — the app icon appears on your home screen</span>
            </li>
          </ol>
          <p className="text-[11px] text-white/40">Must be opened in Safari (not the Chrome or Facebook in-app browser) for this option to appear.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Cart icon button with live item count badge */
/** Account icon — links to /account or /account/login */
function AccountButton() {
  const { customer, loading } = useCustomer();
  if (loading) return <div className="hidden sm:inline-flex p-2 w-[34px]" />;
  if (customer) {
    return (
      <Link
        href="/account"
        aria-label="My Account"
        className="hidden sm:inline-flex items-center gap-1.5 p-2 text-white/70 hover:text-white transition-colors"
      >
        <div className="h-[18px] w-[18px] rounded-full bg-[#c9a96e] flex items-center justify-center text-[10px] font-bold text-[#0a0a0a]">
          {(customer.firstName?.[0] || customer.email[0]).toUpperCase()}
        </div>
      </Link>
    );
  }
  return (
    <Link href="/account/login" aria-label="Sign In" className="hidden sm:inline-flex p-2 text-white/70 hover:text-white transition-colors">
      <User className="h-[18px] w-[18px]" />
    </Link>
  );
}

function CartButton({ accent }: { accent: string }) {
  const { itemCount, openDrawer } = useCart();
  return (
    <button onClick={openDrawer} aria-label="Cart" className="relative p-2 text-white/70 hover:text-white transition-colors">
      <ShoppingBag className="h-[18px] w-[18px]" />
      <span
        className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
        style={{ backgroundColor: accent, color: '#0a0a0a' }}
      >
        {itemCount}
      </span>
    </button>
  );
}
