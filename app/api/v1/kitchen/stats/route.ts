import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getKitchenStats } from '@/lib/kitchen/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/kitchen/stats — kitchen performance stats */
export const GET = withRoute(async (req) => {
  const auth = await requirePermission(req, 'kitchen:queue:read');
  const stats = await getKitchenStats(auth.tenantId);
  return ok(stats);
});
