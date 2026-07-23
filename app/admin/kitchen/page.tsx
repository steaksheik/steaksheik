'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdmin } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  ChefHat,
  Clock,
  CheckCircle2,
  Play,
  Undo2,
  Timer,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Utensils,
  Truck,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';

interface KitchenItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  modifiers: unknown;
  notes: string | null;
}

interface KitchenOrder {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  createdAt: string;
  confirmedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  estimatedReadyAt: string | null;
  deliveryNotes: string | null;
  customerName: string;
  items: KitchenItem[];
  itemCount: number;
  elapsedMinutes: number;
  priority: 'normal' | 'urgent' | 'overdue';
}

interface Stats {
  queue: { confirmed: number; preparing: number; ready: number; total: number };
  today: { completed: number; avgPrepMinutes: number | null };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgClass: string; icon: typeof Clock }> = {
  CONFIRMED: { label: 'New', color: 'text-blue-400', bgClass: 'border-blue-500/30 bg-blue-500/5', icon: Clock },
  PREPARING: { label: 'Preparing', color: 'text-orange-400', bgClass: 'border-orange-500/30 bg-orange-500/5', icon: ChefHat },
  READY: { label: 'Ready', color: 'text-green-400', bgClass: 'border-green-500/30 bg-green-500/5', icon: CheckCircle2 },
};

const PRIORITY_STYLES: Record<string, string> = {
  normal: '',
  urgent: 'ring-2 ring-yellow-500/40',
  overdue: 'ring-2 ring-red-500/50 animate-pulse',
};

export default function KitchenPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canRead = hasPermission('kitchen:queue:read');
  const canWrite = hasPermission('kitchen:queue:write');

  const load = useCallback(async () => {
    if (!canRead) { setLoading(false); return; }
    try {
      const res = await fetch('/api/v1/kitchen/queue', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data.queue);
        setStats(json.data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, [canRead, authHeaders]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 15000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, load]);

  async function handleAction(orderId: string, action: string) {
    setActioning(orderId);
    try {
      const res = await fetch(`/api/v1/kitchen/queue/${orderId}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(`Order ${json.data.orderNumber} → ${json.data.status}`);
        load();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || 'Action failed');
      }
    } finally {
      setActioning(null);
    }
  }

  if (!canRead) {
    return <div className="p-6 text-muted-foreground">You don&apos;t have permission to view the kitchen.</div>;
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const confirmed = orders.filter(o => o.status === 'CONFIRMED');
  const preparing = orders.filter(o => o.status === 'PREPARING');
  const ready = orders.filter(o => o.status === 'READY');

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6" />
            Kitchen Display
          </h1>
          <p className="text-muted-foreground text-sm">Real-time order preparation queue</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'border-green-500/50 text-green-500' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${autoRefresh ? 'animate-spin' : ''}`} style={autoRefresh ? { animationDuration: '3s' } : {}} />
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Clock} label="New" value={stats.queue.confirmed} color="text-blue-400" />
          <StatCard icon={ChefHat} label="Preparing" value={stats.queue.preparing} color="text-orange-400" />
          <StatCard icon={CheckCircle2} label="Ready" value={stats.queue.ready} color="text-green-400" />
          <StatCard icon={TrendingUp} label="Completed Today" value={stats.today.completed} color="text-emerald-400" />
          <StatCard
            icon={Timer}
            label="Avg Prep Time"
            value={stats.today.avgPrepMinutes !== null ? `${stats.today.avgPrepMinutes}m` : '—'}
            color="text-purple-400"
          />
        </div>
      )}

      {/* Empty state */}
      {orders.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Utensils className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Kitchen is clear</p>
            <p className="text-sm text-muted-foreground/70">No orders in the queue right now</p>
          </CardContent>
        </Card>
      )}

      {/* Three-column KDS board */}
      {orders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CONFIRMED column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-blue-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-blue-400">New Orders</h2>
              <Badge variant="secondary" className="ml-auto">{confirmed.length}</Badge>
            </div>
            <div className="space-y-3">
              {confirmed.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  canWrite={canWrite}
                  actioning={actioning}
                  onAction={handleAction}
                />
              ))}
              {confirmed.length === 0 && <EmptyColumn label="No new orders" />}
            </div>
          </div>

          {/* PREPARING column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="h-4 w-4 text-orange-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-orange-400">Preparing</h2>
              <Badge variant="secondary" className="ml-auto">{preparing.length}</Badge>
            </div>
            <div className="space-y-3">
              {preparing.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  canWrite={canWrite}
                  actioning={actioning}
                  onAction={handleAction}
                />
              ))}
              {preparing.length === 0 && <EmptyColumn label="Nothing cooking" />}
            </div>
          </div>

          {/* READY column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-green-400">Ready</h2>
              <Badge variant="secondary" className="ml-auto">{ready.length}</Badge>
            </div>
            <div className="space-y-3">
              {ready.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  canWrite={canWrite}
                  actioning={actioning}
                  onAction={handleAction}
                />
              ))}
              {ready.length === 0 && <EmptyColumn label="No orders ready" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Clock; label: string; value: number | string; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function OrderCard({ order, canWrite, actioning, onAction }: {
  order: KitchenOrder;
  canWrite: boolean;
  actioning: string | null;
  onAction: (id: string, action: string) => void;
}) {
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.CONFIRMED;
  const isActioning = actioning === order.id;

  return (
    <Card className={`${config.bgClass} ${PRIORITY_STYLES[order.priority]} transition-all`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm">{order.orderNumber}</span>
            {order.type === 'DELIVERY'
              ? <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              : <Store className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </div>
          <div className="flex items-center gap-1.5">
            {order.priority === 'overdue' && (
              <AlertTriangle className="h-4 w-4 text-red-400" />
            )}
            {order.priority === 'urgent' && (
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
            )}
            <Badge variant="outline" className={`text-[10px] ${config.color}`}>
              {order.elapsedMinutes}m
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{order.customerName}</p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* Items */}
        <div className="divide-y divide-border/50 mb-3">
          {order.items.map(item => (
            <div key={item.id} className="py-1.5 flex justify-between">
              <div>
                <span className="text-sm font-medium">
                  {item.quantity > 1 && <span className="font-bold mr-1">{item.quantity}×</span>}
                  {item.productName}
                </span>
                {item.variantName && (
                  <span className="text-xs text-muted-foreground ml-1">({item.variantName})</span>
                )}
                {item.notes && (
                  <p className="text-xs text-yellow-500 mt-0.5">⚠ {item.notes}</p>
                )}
                {Array.isArray(item.modifiers) && (item.modifiers as Array<Record<string, string>>).length > 0 ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    + {(item.modifiers as Array<Record<string, string>>).map(m => m.name || '').filter(Boolean).join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {order.deliveryNotes && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 mb-3">
            📝 {order.deliveryNotes}
          </p>
        )}

        {/* Actions */}
        {canWrite && (
          <div className="flex gap-2">
            {order.status === 'CONFIRMED' && (
              <Button
                size="sm"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => onAction(order.id, 'start_preparing')}
                disabled={isActioning}
              >
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Start Preparing
              </Button>
            )}
            {order.status === 'PREPARING' && (
              <Button
                size="sm"
                className="w-full bg-green-500 hover:bg-green-600 text-white"
                onClick={() => onAction(order.id, 'mark_ready')}
                disabled={isActioning}
              >
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Mark Ready
              </Button>
            )}
            {order.status === 'READY' && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onAction(order.id, 'bump_back')}
                disabled={isActioning}
              >
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4 mr-1" />}
                Back to Prep
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyColumn({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-border/50 rounded-lg py-8 text-center">
      <p className="text-sm text-muted-foreground/50">{label}</p>
    </div>
  );
}
