'use client';

import { useCart } from '@/lib/cart-context';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const ACCENT = '#c9a96e';

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

export function CartDrawer() {
  const { items, subtotal, deliveryFee, total, itemCount, drawerOpen, closeDrawer, updateQuantity, removeItem, loading } = useCart();
  const router = useRouter();

  if (!drawerOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={closeDrawer} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col bg-[#111] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" style={{ color: ACCENT }} />
            <h2 className="font-heading text-xl">YOUR ORDER</h2>
            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}>
              {itemCount}
            </span>
          </div>
          <button onClick={closeDrawer} className="rounded-lg p-1 hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-white/40">
              <ShoppingBag className="h-12 w-12" />
              <p className="text-sm">Your cart is empty</p>
              <button onClick={closeDrawer} className="text-xs underline" style={{ color: ACCENT }}>Continue browsing</button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                {item.imageUrl && (
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-white/5">
                    <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Link href={`/product/${item.productSlug}`} onClick={closeDrawer} className="text-sm font-bold hover:underline line-clamp-1">{item.productName}</Link>
                  {item.variantName && <p className="text-xs text-white/40">{item.variantName}</p>}
                  <p className="text-sm mt-1" style={{ color: ACCENT }}>{fmt(item.unitPrice)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      disabled={loading}
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="rounded-md border border-white/10 p-1 hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      disabled={loading}
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="rounded-md border border-white/10 p-1 hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => removeItem(item.id)}
                      className="ml-auto rounded-md p-1 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-right text-sm font-bold">{fmt(item.lineTotal)}</div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-white/10 px-6 py-4 space-y-3">
            <div className="flex justify-between text-sm text-white/60">
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-white/60">
              <span>Delivery</span>
              <span>{deliveryFee === 0 ? <span style={{ color: ACCENT }}>Free</span> : fmt(deliveryFee)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span><span style={{ color: ACCENT }}>{fmt(total)}</span>
            </div>
            <button
              onClick={() => { closeDrawer(); router.push('/checkout'); }}
              className="w-full rounded-lg py-3.5 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
            >
              Checkout — {fmt(total)}
            </button>
            <button onClick={closeDrawer} className="w-full text-center text-xs text-white/40 hover:text-white/60 transition-colors">
              Continue browsing
            </button>
          </div>
        )}
      </div>
    </>
  );
}
