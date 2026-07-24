'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
  Users,
  Globe,
  Settings2,
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
const RechartsVisitors = dynamic(
  () => import('./charts').then((m) => m.VisitorsChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const RechartsSources = dynamic(
  () => import('./charts').then((m) => m.TrafficSourcesChart),
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

interface VisitorData {
  configured: boolean;
  error?: string;
  totalVisitors?: number;
  totalSessions?: number;
  trend?: { date: string; visitors: number; sessions: number }[];
  sources?: { channel: string; sessions: number; users: number }[];
  countries?: { country: string; users: number }[];
}

export default function AnalyticsPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [hourly, setHourly] = useState<HourlyDist[]>([]);
  const [visitors, setVisitors] = useState<VisitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const hdrs = authHeaders();
      const opts = { credentials: 'include' as const, headers: hdrs };

      const [oRes, rRes, pRes, vRes] = await Promise.all([
        fetch('/api/v1/analytics', opts),
        fetch(`/api/v1/analytics/revenue?days=${days}`, opts),
        fetch('/api/v1/analytics/products?limit=10', opts),
        fetch(`/api/v1/analytics/visitors?days=${days}`, opts),
      ]);

      if (oRes.ok) {
        const json = await oRes.json();
        setOverview(json.data);
      }
      if (rRes.ok) {
        const json = await rRes.json();
        setRevenue(json.data ?? []);
      }
      if (vRes.ok) {
        const json = await vRes.json();
        setVisitors(json.data ?? null);
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

      {/* Website Visitors (GA4) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-4.5 w-4.5" />
            Website Visitors
          </h2>
          <Badge variant="secondary" className="text-xs">
            Last {days} days
          </Badge>
        </div>

        {!visitors?.configured ? (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Globe className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Visitor reports aren&apos;t connected yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Add a GA4 Property ID and Service Account JSON in Platform Services to see visitor counts and
                  traffic sources here.
                </p>
              </div>
              <Link href="/admin/services">
                <Button size="sm" variant="outline">
                  <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                  Go to Platform Services
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : visitors.error ? (
          <Card className="shadow-sm">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-red-600">{visitors.error}</p>
              <p className="text-xs text-muted-foreground mt-1">Check the GA4 credentials in Platform Services.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950">
                      <Users className="h-5 w-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Visitors ({days}d)</p>
                      <p className="text-xl font-bold">{(visitors.totalVisitors ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950">
                      <Globe className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sessions ({days}d)</p>
                      <p className="text-xl font-bold">{(visitors.totalSessions ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Visitors Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <RechartsVisitors data={visitors.trend ?? []} />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Where Visitors Come From</CardTitle>
                </CardHeader>
                <CardContent>
                  <RechartsSources data={visitors.sources ?? []} />
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Top Countries</CardTitle>
                </CardHeader>
                <CardContent>
                  {!visitors.countries?.length ? (
                    <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
                      No data available yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(() => {
                        const max = Math.max(...(visitors.countries ?? []).map((c) => c.users), 1);
                        return visitors.countries!.map((c) => (
                          <div key={c.country} className="flex items-center gap-3">
                            <span className="text-xs w-28 shrink-0 truncate">{c.country}</span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${(c.users / max) * 100}%`, backgroundColor: '#c9a96e' }}
                              />
                            </div>
                            <span className="text-xs font-medium w-10 text-right">{c.users}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

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
