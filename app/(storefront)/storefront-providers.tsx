'use client';

import { CartProvider } from '@/lib/cart-context';
import { CustomerProvider } from '@/lib/customer-context';
import { CartDrawer } from './cart-drawer';

export function StorefrontProviders({ children }: { children: React.ReactNode }) {
  return (
    <CustomerProvider>
      <CartProvider>
        {children}
        <CartDrawer />
      </CartProvider>
    </CustomerProvider>
  );
}
