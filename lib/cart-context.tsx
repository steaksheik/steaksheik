'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';

export interface CartModifier {
  groupId: string;
  groupName: string;
  modifierId: string;
  name: string;
  priceAdjustment: number;
}

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string | null;
  modifiers: unknown;
  notes: string | null;
}

interface CartState {
  cartId: string | null;
  token: string | null;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  couponCode: string | null;
  discountAmount: number;
  total: number;
  itemCount: number;
  loading: boolean;
  drawerOpen: boolean;
}

interface CartContextValue extends CartState {
  addItem: (productId: string, variantId?: string, quantity?: number, modifiers?: unknown, notes?: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  removeModifier: (itemId: string, modifierId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
  clearLocalCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_TOKEN_KEY = 'dk_cart_token';

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CART_TOKEN_KEY);
}
function storeToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(CART_TOKEN_KEY, token);
}
function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(CART_TOKEN_KEY);
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'API error');
  return json.data;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({
    cartId: null,
    token: null,
    items: [],
    subtotal: 0,
    deliveryFee: 0,
    couponCode: null,
    discountAmount: 0,
    total: 0,
    itemCount: 0,
    loading: false,
    drawerOpen: false,
  });

  const syncFromApi = useCallback((data: CartState & { token: string; couponError?: string | null }) => {
    storeToken(data.token);
    if (data.couponError) toast.error(data.couponError);
    setState(prev => ({
      ...prev,
      cartId: data.cartId,
      token: data.token,
      items: data.items,
      subtotal: data.subtotal,
      deliveryFee: data.deliveryFee,
      couponCode: data.couponCode ?? null,
      discountAmount: data.discountAmount ?? 0,
      total: data.total,
      itemCount: data.itemCount,
      loading: false,
    }));
  }, []);

  // Load cart on mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    fetch(`/api/v1/cart?token=${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) syncFromApi(json.data);
        else clearToken();
      })
      .catch(() => clearToken());
  }, [syncFromApi]);

  const addItem = useCallback(async (
    productId: string,
    variantId?: string,
    quantity = 1,
    modifiers?: unknown,
    notes?: string
  ) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const payload: Record<string, unknown> = { productId, quantity };
      const token = getStoredToken();
      if (token) payload.token = token;
      if (variantId) payload.variantId = variantId;
      if (modifiers) payload.modifiers = modifiers;
      if (notes) payload.notes = notes;

      const data = await apiFetch('/api/v1/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      syncFromApi(data);
      setState(prev => ({ ...prev, drawerOpen: true }));
      toast.success('Added to cart');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to add item');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [syncFromApi]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    const token = getStoredToken();
    if (!token) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const data = await apiFetch(`/api/v1/cart/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, token }),
      });
      syncFromApi(data);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [syncFromApi]);

  const removeItemFn = useCallback(async (itemId: string) => {
    const token = getStoredToken();
    if (!token) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const data = await apiFetch(`/api/v1/cart/${itemId}?token=${token}`, { method: 'DELETE' });
      syncFromApi(data);
      toast.success('Item removed');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to remove');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [syncFromApi]);

  const removeModifier = useCallback(async (itemId: string, modifierId: string) => {
    const token = getStoredToken();
    if (!token) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const data = await apiFetch(`/api/v1/cart/${itemId}/modifiers/${modifierId}?token=${token}`, { method: 'DELETE' });
      syncFromApi(data);
      toast.success('Extra removed');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to remove extra');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [syncFromApi]);

  const applyCoupon = useCallback(async (code: string) => {
    const token = getStoredToken();
    if (!token) { toast.error('Add an item to your cart first'); return false; }
    setState(prev => ({ ...prev, loading: true }));
    try {
      const data = await apiFetch('/api/v1/cart/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartToken: token, code }),
      });
      syncFromApi(data);
      toast.success(`Code "${data.couponCode}" applied`);
      return true;
    } catch (e) {
      toast.error((e as Error).message || 'Invalid code');
      setState(prev => ({ ...prev, loading: false }));
      return false;
    }
  }, [syncFromApi]);

  const removeCoupon = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const data = await apiFetch('/api/v1/cart/coupon', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartToken: token }),
      });
      syncFromApi(data);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to remove code');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [syncFromApi]);

  const clearLocalCart = useCallback(() => {
    clearToken();
    setState({
      cartId: null, token: null, items: [], subtotal: 0, deliveryFee: 0,
      couponCode: null, discountAmount: 0,
      total: 0, itemCount: 0, loading: false, drawerOpen: false,
    });
  }, []);

  return (
    <CartContext.Provider value={{
      ...state,
      addItem,
      updateQuantity,
      removeItem: removeItemFn,
      removeModifier,
      applyCoupon,
      removeCoupon,
      openDrawer: () => setState(prev => ({ ...prev, drawerOpen: true })),
      closeDrawer: () => setState(prev => ({ ...prev, drawerOpen: false })),
      clearLocalCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
