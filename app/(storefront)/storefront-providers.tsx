'use client';

import { CartProvider } from '@/lib/cart-context';
import { CustomerProvider } from '@/lib/customer-context';
import { CartDrawer } from './cart-drawer';
import { BrandThemeProvider, type BrandThemeValue } from './theme-context';

export function StorefrontProviders({
  theme,
  children,
}: {
  theme?: Partial<BrandThemeValue> | null;
  children: React.ReactNode;
}) {
  return (
    <BrandThemeProvider theme={theme}>
      <CustomerProvider>
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </CustomerProvider>
    </BrandThemeProvider>
  );
}
