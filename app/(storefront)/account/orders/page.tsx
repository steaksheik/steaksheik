'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Package, ChevronDown, ChevronUp } from 'lucide-react';

const ACCENT = '#c9a96e';

interface OrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
  paymentStatus: string;
}

const STATUS_COLOURS: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  CONFIRMED: 'bg-blue-500/20 text-blue-400',
  PREPARING: 'bg-orange-500/20 text-orange-400',
  READY: 'bg-green-500/20 text-green-400',
  DISPATCHED: 'bg-purple-500/20 text-purple-400',
  DELIVERED: 'bg-emerald-500/20 text-emerald-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
  REFUNDED: 'bg-gray-500/20 text-gray-400',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/customers/orders?page=${page}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data.orders);
        setTotalPages(json.data.pagination.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  if (loading && orders.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: ACCENT }} /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl tracking-wide mb-1">ORDER HISTORY</h2>
        <p className="text-sm text-neutral-400">View and track your orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
          <p className="text-neutral-400">No orders yet</p>
          <a href="/menu" className="inline-block mt-4 text-sm font-semibold" style={{ color: ACCENT }}>Browse the menu</a>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-sm font-semibold text-white">{order.orderNumber}</span>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${STATUS_COLOURS[order.status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: ACCENT }}>{fmt(order.total)}</span>
                  {expanded === order.id ? <ChevronUp className="h-4 w-4 text-neutral-400" /> : <ChevronDown className="h-4 w-4 text-neutral-400" />}
                </div>
              </button>
              {expanded === order.id && (
                <div className="border-t border-white/10 px-5 py-4 space-y-3">
                  <div className="text-xs text-neutral-400 flex gap-4">
                    <span>Type: <strong className="text-white">{order.type}</strong></span>
                    <span>Payment: <strong className="text-white">{order.paymentStatus}</strong></span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {order.items.map(item => (
                      <div key={item.id} className="flex justify-between py-2 text-sm">
                        <div>
                          <span className="text-white">{item.productName}</span>
                          {item.variantName && <span className="text-neutral-500 ml-1">({item.variantName})</span>}
                          <span className="text-neutral-500 ml-2">×{item.quantity}</span>
                        </div>
                        <span className="text-neutral-300">{fmt(item.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-right space-y-1 pt-2 border-t border-white/5">
                    <div className="text-neutral-400">Subtotal: {fmt(order.subtotal)}</div>
                    {order.deliveryFee > 0 && <div className="text-neutral-400">Delivery: {fmt(order.deliveryFee)}</div>}
                    {order.discount > 0 && <div className="text-green-400">Discount: -{fmt(order.discount)}</div>}
                    <div className="font-semibold text-white">Total: {fmt(order.total)}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm rounded-lg border border-white/10 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-neutral-400">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm rounded-lg border border-white/10 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
