import { prisma } from '@/lib/db';
import { OrderStatus } from '@prisma/client';

// ── Types ───────────────────────────────────────────────────
export interface OverviewStats {
  revenue: { today: number; thisWeek: number; thisMonth: number; allTime: number };
  orders: { today: number; thisWeek: number; thisMonth: number; allTime: number };
  customers: { total: number; newThisMonth: number; returning: number };
  averageOrderValue: number;
  topStatus: { status: string; count: number }[];
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

export interface OrderTypeSplit {
  type: string;
  count: number;
  revenue: number;
}

export interface HourlyDistribution {
  hour: number;
  count: number;
}

// ── Helpers ─────────────────────────────────────────────────
function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfWeek(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  const s = new Date(d);
  s.setUTCDate(s.getUTCDate() - diff);
  return startOfDay(s);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

const COMPLETED_STATUSES: OrderStatus[] = [
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DISPATCHED',
  'DELIVERED',
] as const as unknown as OrderStatus[];

// ── Overview Stats ──────────────────────────────────────────
export async function getOverviewStats(tenantId: string): Promise<OverviewStats> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const baseWhere = {
    tenantId,
    status: { in: COMPLETED_STATUSES },
  };

  // Parallel queries for efficiency
  const [
    allTimeAgg,
    monthAgg,
    weekAgg,
    todayAgg,
    totalCustomers,
    newCustomersMonth,
    returningCustomers,
    statusCounts,
  ] = await Promise.all([
    // All-time revenue + count
    prisma.order.aggregate({
      where: baseWhere,
      _sum: { total: true },
      _count: true,
    }),
    // This month
    prisma.order.aggregate({
      where: { ...baseWhere, createdAt: { gte: monthStart } },
      _sum: { total: true },
      _count: true,
    }),
    // This week
    prisma.order.aggregate({
      where: { ...baseWhere, createdAt: { gte: weekStart } },
      _sum: { total: true },
      _count: true,
    }),
    // Today
    prisma.order.aggregate({
      where: { ...baseWhere, createdAt: { gte: todayStart } },
      _sum: { total: true },
      _count: true,
    }),
    // Total customers
    prisma.customer.count({ where: { tenantId } }),
    // New customers this month
    prisma.customer.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
    // Returning customers (>1 order)
    prisma.customer.count({
      where: {
        tenantId,
        orders: { some: { status: { in: COMPLETED_STATUSES } } },
      },
    }),
    // Status distribution
    prisma.order.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
      orderBy: { _count: { status: 'desc' } },
    }),
  ]);

  const allTimeRevenue = Number(allTimeAgg._sum.total ?? 0);
  const allTimeOrders = allTimeAgg._count;

  return {
    revenue: {
      today: Number(todayAgg._sum.total ?? 0),
      thisWeek: Number(weekAgg._sum.total ?? 0),
      thisMonth: Number(monthAgg._sum.total ?? 0),
      allTime: allTimeRevenue,
    },
    orders: {
      today: todayAgg._count,
      thisWeek: weekAgg._count,
      thisMonth: monthAgg._count,
      allTime: allTimeOrders,
    },
    customers: {
      total: totalCustomers,
      newThisMonth: newCustomersMonth,
      returning: returningCustomers,
    },
    averageOrderValue: allTimeOrders > 0 ? allTimeRevenue / allTimeOrders : 0,
    topStatus: statusCounts.map((s: { status: string; _count: number }) => ({ status: s.status, count: s._count })),
  };
}

// ── Revenue Time Series ─────────────────────────────────────
export async function getRevenueTimeSeries(
  tenantId: string,
  days: number = 30,
): Promise<RevenueDataPoint[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceStart = startOfDay(since);

  // Raw query for date grouping — more efficient than per-day queries
  const rows = await prisma.$queryRaw<
    { day: Date; revenue: number; orders: bigint }[]
  >`
    SELECT
      DATE_TRUNC('day', "createdAt") AS day,
      COALESCE(SUM("total"), 0)::float AS revenue,
      COUNT(*)::bigint AS orders
    FROM orders
    WHERE "tenantId" = ${tenantId}
      AND "status" IN ('CONFIRMED','PREPARING','READY','DISPATCHED','DELIVERED')
      AND "createdAt" >= ${sinceStart}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY day ASC
  `;

  // Fill in missing days with 0
  const map = new Map<string, { revenue: number; orders: number }>();
  for (const r of rows) {
    const key = new Date(r.day).toISOString().split('T')[0];
    map.set(key, { revenue: Number(r.revenue), orders: Number(r.orders) });
  }

  const result: RevenueDataPoint[] = [];
  const cursor = new Date(sinceStart);
  const today = startOfDay(new Date());
  while (cursor <= today) {
    const key = cursor.toISOString().split('T')[0];
    const entry = map.get(key);
    result.push({
      date: key,
      revenue: entry?.revenue ?? 0,
      orders: entry?.orders ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

// ── Top Products ────────────────────────────────────────────
export async function getTopProducts(
  tenantId: string,
  limit: number = 10,
): Promise<TopProduct[]> {
  const rows = await prisma.$queryRaw<
    { productId: string; productName: string; totalQuantity: bigint; totalRevenue: number; orderCount: bigint }[]
  >`
    SELECT
      oi."productId",
      oi."productName",
      SUM(oi."quantity")::bigint AS "totalQuantity",
      COALESCE(SUM(oi."totalPrice"), 0)::float AS "totalRevenue",
      COUNT(DISTINCT oi."orderId")::bigint AS "orderCount"
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    WHERE o."tenantId" = ${tenantId}
      AND o."status" IN ('CONFIRMED','PREPARING','READY','DISPATCHED','DELIVERED')
    GROUP BY oi."productId", oi."productName"
    ORDER BY "totalRevenue" DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    totalQuantity: Number(r.totalQuantity),
    totalRevenue: Number(r.totalRevenue),
    orderCount: Number(r.orderCount),
  }));
}

// ── Order Type Split ────────────────────────────────────────
export async function getOrderTypeSplit(tenantId: string): Promise<OrderTypeSplit[]> {
  const result = await prisma.order.groupBy({
    by: ['type'],
    where: { tenantId, status: { in: COMPLETED_STATUSES } },
    _count: true,
    _sum: { total: true },
  });

  return result.map((r: { type: string; _count: number; _sum: { total: unknown } }) => ({
    type: r.type,
    count: r._count,
    revenue: Number(r._sum.total ?? 0),
  }));
}

// ── Hourly Order Distribution ───────────────────────────────
export async function getHourlyDistribution(
  tenantId: string,
  days: number = 30,
): Promise<HourlyDistribution[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const rows = await prisma.$queryRaw<{ hour: number; count: bigint }[]>`
    SELECT
      EXTRACT(HOUR FROM "createdAt")::int AS hour,
      COUNT(*)::bigint AS count
    FROM orders
    WHERE "tenantId" = ${tenantId}
      AND "status" IN ('CONFIRMED','PREPARING','READY','DISPATCHED','DELIVERED')
      AND "createdAt" >= ${since}
    GROUP BY EXTRACT(HOUR FROM "createdAt")
    ORDER BY hour ASC
  `;

  // Fill all 24 hours
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.hour, Number(r.count));

  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: map.get(i) ?? 0,
  }));
}

// ── Kitchen Performance ─────────────────────────────────────
export async function getKitchenPerformance(tenantId: string, days: number = 30) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const rows = await prisma.$queryRaw<
    { avgPrepMinutes: number; avgTotalMinutes: number; completed: bigint }[]
  >`
    SELECT
      AVG(EXTRACT(EPOCH FROM ("readyAt" - "preparingAt")) / 60)::float AS "avgPrepMinutes",
      AVG(EXTRACT(EPOCH FROM ("deliveredAt" - "createdAt")) / 60)::float AS "avgTotalMinutes",
      COUNT(*)::bigint AS completed
    FROM orders
    WHERE "tenantId" = ${tenantId}
      AND "status" = 'DELIVERED'
      AND "preparingAt" IS NOT NULL
      AND "readyAt" IS NOT NULL
      AND "deliveredAt" IS NOT NULL
      AND "createdAt" >= ${since}
  `;

  const row = rows[0];
  return {
    avgPrepMinutes: row?.avgPrepMinutes ? Math.round(row.avgPrepMinutes * 10) / 10 : null,
    avgTotalMinutes: row?.avgTotalMinutes ? Math.round(row.avgTotalMinutes * 10) / 10 : null,
    completedOrders: Number(row?.completed ?? 0),
  };
}
