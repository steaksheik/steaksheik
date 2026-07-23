'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ChevronDown, Clock, CheckCircle, Package, Truck, MapPin, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Payment {
  id: string;
  status: string;
  amount: number;
  method: string | null;
  stripeSessionId: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  deliveryFirstName: string | null;
  deliveryLastName: string | null;
  deliveryLine1: string | null;
  deliveryCity: string | null;
  deliveryPostcode: string | null;
  deliveryPhone: string | null;
  deliveryNotes: string | null;
  guestEmail: string | null;
  guestName: string | null;
  guestPhone: string | null;
  customerId: string | null;
  createdAt: string;
  confirmedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  items: OrderItem[];
  payments: Payment[];
}

const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED'];
const STATUS_ICONS: Record<string, typeof Clock> = {
  PENDING: Clock, CONFIRMED: CheckCircle, PREPARING: Package, READY: CheckCircle, DISPATCHED: Truck, DELIVERED: MapPin, CANCELLED: XCircle, REFUNDED: XCircle,
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PREPARING: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  READY: 'bg-green-500/10 text-green-400 border-green-500/20',
  DISPATCHED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  DELIVERED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  REFUNDED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

export default function OrdersPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const canWrite = hasPermission('ordering:orders:write');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter ? `/api/v1/orders?status=${filter}&limit=100` : '/api/v1/orders?limit=100';
      const res = await fetch(url, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setOrders(json.data.orders);
        setTotal(json.data.total);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [filter, authHeaders]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Order updated to ${status}`);
        loadOrders();
      } else {
        toast.error(json.error?.message || 'Update failed');
      }
    } catch {
      toast.error('Update failed');
    }
    setUpdating(null);
  };

  const nextStatus = (current: string) => {
    const idx = STATUS_FLOW.indexOf(current);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">{total} total orders</p>
        </div>
        <button onClick={loadOrders} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('')} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${!filter ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>All</button>
        {['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No orders found</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const Icon = STATUS_ICONS[order.status] || Clock;
            const isExpanded = expanded === order.id;
            const next = nextStatus(order.status);
            return (
              <Card key={order.id} className="overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : order.id)} className="w-full text-left">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-sm">{order.orderNumber}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{fmtDate(order.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={STATUS_COLORS[order.status]}>{order.status}</Badge>
                        <Badge variant="outline">{order.type}</Badge>
                        <span className="font-bold text-sm">{fmt(order.total)}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </CardHeader>
                </button>
                {isExpanded && (
                  <CardContent className="px-4 pb-4 pt-0 border-t">
                    <div className="grid md:grid-cols-2 gap-6 mt-4">
                      {/* Items */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Items</h4>
                        <div className="space-y-1">
                          {order.items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.productName}{item.variantName ? ` (${item.variantName})` : ''}</span>
                              <span>{fmt(item.totalPrice)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-1 mt-2 space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
                            <div className="flex justify-between text-xs text-muted-foreground"><span>Delivery</span><span>{order.deliveryFee === 0 ? 'Free' : fmt(order.deliveryFee)}</span></div>
                            <div className="flex justify-between text-sm font-bold"><span>Total</span><span>{fmt(order.total)}</span></div>
                          </div>
                        </div>
                      </div>
                      {/* Customer + delivery */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Customer</h4>
                          <p className="text-sm">{order.guestName || order.deliveryFirstName || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{order.guestEmail || '-'}</p>
                          <p className="text-xs text-muted-foreground">{order.guestPhone || order.deliveryPhone || '-'}</p>
                        </div>
                        {order.type === 'DELIVERY' && order.deliveryLine1 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Delivery Address</h4>
                            <p className="text-sm">{order.deliveryLine1}</p>
                            <p className="text-sm">{order.deliveryCity}, {order.deliveryPostcode}</p>
                            {order.deliveryNotes && <p className="text-xs text-muted-foreground mt-1">Notes: {order.deliveryNotes}</p>}
                          </div>
                        )}
                        {order.payments.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Payment</h4>
                            {order.payments.map(p => (
                              <div key={p.id} className="text-sm">
                                <Badge variant="outline" className={p.status === 'SUCCEEDED' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}>{p.status}</Badge>
                                <span className="ml-2">{fmt(p.amount)} via {p.method || 'pending'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {order.cancellationReason && (
                          <p className="text-sm text-red-400">Cancelled: {order.cancellationReason}</p>
                        )}
                      </div>
                    </div>
                    {/* Status actions */}
                    {canWrite && (next || order.status !== 'CANCELLED') && (
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        {next && (
                          <button
                            disabled={updating === order.id}
                            onClick={() => updateStatus(order.id, next)}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {updating === order.id ? 'Updating…' : `Mark as ${next}`}
                          </button>
                        )}
                        {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                          <button
                            disabled={updating === order.id}
                            onClick={() => updateStatus(order.id, 'CANCELLED')}
                            className="rounded-md border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            Cancel Order
                          </button>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
