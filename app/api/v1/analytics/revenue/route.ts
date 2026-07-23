import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getRevenueTimeSeries } from '@/lib/analytics/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/analytics/revenue?days=30 — revenue time series */
export const GET = withRoute(async (req) => {
  const auth = await requirePermission(req, 'analytics:reports:read');
  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '30', 10) || 30, 7), 90);
  const data = await getRevenueTimeSeries(auth.tenantId, days);
  return ok(data);
});
