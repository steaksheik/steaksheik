import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getOverviewStats, getOrderTypeSplit, getKitchenPerformance } from '@/lib/analytics/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/analytics — overview dashboard stats */
export const GET = withRoute(async (req) => {
  const auth = await requirePermission(req, 'analytics:dashboard:read');
  const [overview, orderTypes, kitchen] = await Promise.all([
    getOverviewStats(auth.tenantId),
    getOrderTypeSplit(auth.tenantId),
    getKitchenPerformance(auth.tenantId),
  ]);
  return ok({ overview, orderTypes, kitchen });
});
