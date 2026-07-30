import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { getLoyaltyDashboard } from '@/lib/ordering/loyalty-service';
import { getCustomerSession } from '@/lib/auth/customer-session';

export const dynamic = 'force-dynamic';

/** GET /api/v1/customers/loyalty — loyalty dashboard data */
export const GET = withRoute(async () => {
  const session = await getCustomerSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });

  const dashboard = await getLoyaltyDashboard(session.customerId, session.tenantId);
  return ok(dashboard);
});
