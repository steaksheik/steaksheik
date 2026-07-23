'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Calendar,
  TrendingUp,
  ShoppingCart,
  Package,
  Clock,
  RefreshCw,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy-load recharts to avoid SSR issues
const RechartsArea = dynamic(
  () => import('./charts').then((m) => m.RevenueChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const RechartsBar = dynamic(
  () => import('./charts').then((m) => m.TopProductsChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const RechartsHourly = dynamic(
  () => import('./charts').then((m) => m.HourlyChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const RechartsPie = dynamic(
  () => import('./charts').then((m) => m.OrderTypePie),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

function ChartSkeleton() {
  return <div className="h-[300px] rounded-lg bg-muted/30 animate-pulse" />;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

interface HourlyDist {
  hour: number;
  count: number;
}

interface OverviewData {
  overview: {
    revenue: { today: number; thisWeek: number; thisMonth: number; allTime: number };
    orders: { today: number; thisWeek: number; thisMonth: number; allTime: number };
    customers: { total: number; newThisMonth: number; returning: number };
    averageOrderValue: number;
  };
  orderTypes: { type: string; count: number; revenue: number }[];
  kitchen: { avgPrepMinutes: number | null; avgTotalMinutes: number | null; completedOrders: number };
}

export default function AnalyticsPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [hourly, setHourly] = useState<HourlyDist[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const hdrs = authHeaders();
      const opts = { credentials: 'include' as const, headers: hdrs };

      const [oRes, rRes, pRes] = await Promise.all([
        fetch('/api/v1/analytics', opts),
        fetch(`/api/v1/analytics/revenue?days=${days}`, opts),
        fetch('/api/v1/analytics/products?limit=10', opts),
      ]);

      if (oRes.ok) {
        const json = await oRes.json();
        setOverview(json.data);
      }
      if (rRes.ok) {
        const json = await rRes.json();
        setRevenue(json.data ?? []);
      }
      if (pRes.ok) {
        const json = await pRes.json();
        setProducts(json.data?.topProducts ?? []);
        setHourly(json.data?.hourlyDistribution ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [authHeaders, days]);

  useEffect(() => { load(); }, [load]);

  if (!hasPermission('analytics:dashboard:read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don&apos;t have permission to view analytics.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const o = overview?.overview;
  const k = overview?.kitchen;
  const totalRevenue = revenue.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = revenue.reduce((s, r) => s + r.orders, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Revenue trends, product performance, and operational insights.</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 60, 90].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
              className="text-xs"
            >
              {d}d
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={load} className="ml-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue ({days}d)</p>
                <p className="text-xl font-bold">{fmt(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Orders ({days}d)</p>
                <p className="text-xl font-bold">{totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Prep Time</p>
                <p className="text-xl font-bold">
                  {k?.avgPrepMinutes != null ? `${k.avgPrepMinutes} min` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950">
                <Package className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Order Value</p>
                <p className="text-xl font-bold">{fmt(o?.averageOrderValue ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Revenue Trend
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              Last {days} days
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <RechartsArea data={revenue} />
        </CardContent>
      </Card>

      {/* Two-column: Top Products + Order Type Split */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top Products by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RechartsBar data={products} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Delivery vs Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <RechartsPie data={overview?.orderTypes ?? []} />
          </CardContent>
        </Card>
      </div>

      {/* Hourly Distribution */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hourly Order Distribution (Last {days} Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RechartsHourly data={hourly} />
        </CardContent>
      </Card>
    </div>
  );
}
