'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useCustomer } from '@/lib/customer-context';
import { User, ShoppingBag, MapPin, Award, LogOut, Loader2 } from 'lucide-react';

const ACCENT = '#c9a96e';

const NAV_ITEMS = [
  { href: '/account', label: 'Profile', icon: User },
  { href: '/account/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/loyalty', label: 'Rewards', icon: Award },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { customer, loading, logout } = useCustomer();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !customer) {
      router.replace('/account/login');
    }
  }, [loading, customer, router]);

  // Don't apply account layout to login page
  if (pathname === '/account/login') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="font-heading text-3xl tracking-wide mb-8" style={{ color: '#c9a96e' }}>
        MY ACCOUNT
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
        {/* Sidebar */}
        <nav className="space-y-1">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#c9a96e]/10 text-[#c9a96e]'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={async () => {
              await logout();
              router.replace('/');
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-neutral-400 hover:text-red-400 hover:bg-red-400/5 transition-colors w-full text-left"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </nav>
        {/* Content */}
        <div className="min-h-[400px]">{children}</div>
      </div>
    </div>
  );
}
