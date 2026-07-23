import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getOverviewStats, getTopProducts } from '@/lib/analytics/service';
import { sendDailySummary } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

/** POST /api/v1/notifications/daily-summary — trigger daily summary email manually */
export const POST = withRoute(async (req) => {
  const auth = await requirePermission(req, 'notifications:settings:write');
  const [overview, topProducts] = await Promise.all([
    getOverviewStats(auth.tenantId),
    getTopProducts(auth.tenantId, 1),
  ]);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const sent = await sendDailySummary({
    ordersToday: overview.orders.today,
    revenueToday: overview.revenue.today,
    newCustomers: overview.customers.newThisMonth,
    topProduct: topProducts[0]?.productName ?? 'N/A',
    date: today,
  });

  return ok({ sent, date: today });
});
