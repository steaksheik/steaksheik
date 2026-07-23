import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getKitchenQueue, getKitchenStats } from '@/lib/kitchen/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/kitchen/queue — get active kitchen queue + stats */
export const GET = withRoute(async (req) => {
  const auth = await requirePermission(req, 'kitchen:queue:read');
  const [queue, stats] = await Promise.all([
    getKitchenQueue(auth.tenantId),
    getKitchenStats(auth.tenantId),
  ]);
  return ok({ queue, stats });
});
