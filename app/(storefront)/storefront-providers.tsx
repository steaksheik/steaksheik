'use client';

import { CartProvider } from '@/lib/cart-context';
import { CustomerProvider } from '@/lib/customer-context';
import { CartDrawer } from './cart-drawer';
import { BrandThemeProvider } from './theme-context';

export function StorefrontProviders({
  accentColor,
  children,
}: {
  accentColor?: string | null;
  children: React.ReactNode;
}) {
  return (
    <BrandThemeProvider accentColor={accentColor}>
      <CustomerProvider>
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </CustomerProvider>
    </BrandThemeProvider>
  );
}
