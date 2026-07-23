'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react';

const ACCENT = '#c9a96e';

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

interface OrderData {
  orderNumber: string;
  status: string;
  type: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: { productName: string; variantName: string | null; quantity: number; unitPrice: number; totalPrice: number }[];
  deliveryFirstName: string | null;
  deliveryLine1: string | null;
  deliveryCity: string | null;
  deliveryPostcode: string | null;
  guestEmail: string | null;
  guestName: string | null;
  createdAt: string;
}

export default function OrderConfirmationPage() {
  const params = useSearchParams();
  const orderNumber = params.get('orderNumber');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderNumber) { setLoading(false); setError(true); return; }
    fetch(`/api/v1/orders?orderNumber=${orderNumber}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setOrder(json.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>;
  }

  if (error || !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-white/50">
        <AlertCircle className="h-12 w-12" />
        <p>Order not found</p>
        <Link href="/menu" className="text-sm underline" style={{ color: ACCENT }}>Back to menu</Link>
      </div>
    );
  }

  const isPending = order.status === 'PENDING';

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16 text-center">
      <div className="mb-8">
        {isPending ? (
          <Clock className="mx-auto h-16 w-16 text-yellow-400 mb-4" />
        ) : (
          <CheckCircle className="mx-auto h-16 w-16 mb-4" style={{ color: ACCENT }} />
        )}
        <h1 className="font-heading text-3xl sm:text-4xl mb-2">
          {isPending ? 'AWAITING PAYMENT' : 'ORDER CONFIRMED'}
        </h1>
        <p className="text-white/50 text-sm">
          {isPending ? 'Your order is being processed.' : 'Thank you! Your order is being prepared.'}
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-left space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Order Number</span>
          <span className="font-bold" style={{ color: ACCENT }}>{order.orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Type</span>
          <span className="font-bold">{order.type === 'DELIVERY' ? 'Delivery' : 'Collection'}</span>
        </div>
        {order.type === 'DELIVERY' && order.deliveryLine1 && (
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Deliver to</span>
            <span className="text-right">
              {order.deliveryFirstName && <>{order.deliveryFirstName}<br /></>}
              {order.deliveryLine1}<br />
              {order.deliveryCity}, {order.deliveryPostcode}
            </span>
          </div>
        )}
        <div className="border-t border-white/10 pt-4 space-y-2">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-white/80">{item.quantity}x {item.productName}{item.variantName && <span className="text-white/40"> ({item.variantName})</span>}</span>
              <span>{fmt(item.totalPrice)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-4 space-y-2">
          <div className="flex justify-between text-sm text-white/50"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
          <div className="flex justify-between text-sm text-white/50"><span>Delivery</span><span>{order.deliveryFee === 0 ? 'Free' : fmt(order.deliveryFee)}</span></div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-white/10">
            <span>Total</span><span style={{ color: ACCENT }}>{fmt(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link href="/menu" className="rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.01]" style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}>Order Again</Link>
        <Link href="/" className="text-sm text-white/40 hover:text-white/60 underline">Back to home</Link>
      </div>
    </div>
  );
}
