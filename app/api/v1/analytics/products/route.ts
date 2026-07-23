import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getTopProducts, getHourlyDistribution } from '@/lib/analytics/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/analytics/products?limit=10 — top products + hourly distribution */
export const GET = withRoute(async (req) => {
  const auth = await requirePermission(req, 'analytics:reports:read');
  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, 1), 50);
  const [topProducts, hourlyDistribution] = await Promise.all([
    getTopProducts(auth.tenantId, limit),
    getHourlyDistribution(auth.tenantId),
  ]);
  return ok({ topProducts, hourlyDistribution });
});
