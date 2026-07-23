'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  PoundSterling,
  ShoppingCart,
  Users,
  TrendingUp,
  ChefHat,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Truck,
  Package,
  BarChart3,
} from 'lucide-react';

interface DashboardData {
  overview: {
    revenue: { today: number; thisWeek: number; thisMonth: number; allTime: number };
    orders: { today: number; thisWeek: number; thisMonth: number; allTime: number };
    customers: { total: number; newThisMonth: number; returning: number };
    averageOrderValue: number;
    topStatus: { status: string; count: number }[];
  };
  orderTypes: { type: string; count: number; revenue: number }[];
  kitchen: { avgPrepMinutes: number | null; avgTotalMinutes: number | null; completedOrders: number };
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  PREPARING: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  READY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  DISPATCHED: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  REFUNDED: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

export default function AdminDashboard() {
  const { authHeaders, hasPermission } = useAdmin();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/analytics', {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const o = data?.overview;
  const k = data?.kitchen;

  const kpiCards = [
    {
      label: "Today's Revenue",
      value: fmt(o?.revenue.today ?? 0),
      sub: `${fmt(o?.revenue.thisWeek ?? 0)} this week`,
      icon: PoundSterling,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      label: "Today's Orders",
      value: String(o?.orders.today ?? 0),
      sub: `${o?.orders.thisMonth ?? 0} this month`,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: 'Avg Order Value',
      value: fmt(o?.averageOrderValue ?? 0),
      sub: `${o?.orders.allTime ?? 0} total orders`,
      icon: TrendingUp,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      label: 'Total Customers',
      value: fmtNum(o?.customers.total ?? 0),
      sub: `${o?.customers.newThisMonth ?? 0} new this month`,
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50 dark:bg-violet-950',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time performance overview.</p>
        </div>
        {hasPermission('analytics:reports:read') && (
          <Link
            href="/admin/analytics"
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <BarChart3 className="h-4 w-4" />
            Detailed Analytics
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((c) => (
          <Card key={c.label} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-column: Order Status + Kitchen & Delivery */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Order Status Breakdown */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Order Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {o?.topStatus && o.topStatus.length > 0 ? (
              <div className="space-y-3">
                {o.topStatus.map((s) => {
                  const total = o.orders.allTime || 1;
                  const pct = Math.round((s.count / total) * 100);
                  return (
                    <div key={s.status} className="flex items-center gap-3">
                      <Badge variant="secondary" className={`text-xs w-24 justify-center ${STATUS_COLORS[s.status] ?? ''}`}>
                        {s.status}
                      </Badge>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-foreground/20"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{s.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Kitchen & Delivery */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Kitchen & Fulfilment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <ChefHat className="h-5 w-5 mx-auto text-amber-500 mb-2" />
                <p className="text-2xl font-bold">
                  {k?.avgPrepMinutes != null ? `${k.avgPrepMinutes}m` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Prep Time</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <Clock className="h-5 w-5 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold">
                  {k?.avgTotalMinutes != null ? `${k.avgTotalMinutes}m` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Order-to-Deliver</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <Package className="h-5 w-5 mx-auto text-emerald-500 mb-2" />
                <p className="text-2xl font-bold">{k?.completedOrders ?? 0}</p>
                <p className="text-xs text-muted-foreground">Completed (30d)</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <Truck className="h-5 w-5 mx-auto text-violet-500 mb-2" />
                {(() => {
                  const delivery = data?.orderTypes?.find((t) => t.type === 'DELIVERY');
                  const collection = data?.orderTypes?.find((t) => t.type === 'COLLECTION');
                  const total = (delivery?.count ?? 0) + (collection?.count ?? 0);
                  const pct = total > 0 ? Math.round(((delivery?.count ?? 0) / total) * 100) : 0;
                  return (
                    <>
                      <p className="text-2xl font-bold">{pct}%</p>
                      <p className="text-xs text-muted-foreground">Delivery Rate</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'View Orders', href: '/admin/orders', icon: ShoppingCart, desc: 'Manage active orders' },
            { label: 'Kitchen Queue', href: '/admin/kitchen', icon: ChefHat, desc: 'Kitchen display system' },
            { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, desc: 'Charts & reports' },
            { label: 'Customers', href: '/admin/customers', icon: Users, desc: 'Customer directory' },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <a.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
