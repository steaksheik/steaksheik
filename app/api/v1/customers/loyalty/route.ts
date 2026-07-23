import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { cookies } from 'next/headers';
import { getLoyaltyDashboard } from '@/lib/ordering/loyalty-service';

export const dynamic = 'force-dynamic';

const CUSTOMER_SESSION_COOKIE = 'dk_customer_session';

async function getCustomerFromSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const data = JSON.parse(Buffer.from(raw, 'base64').toString());
    if (data.exp < Date.now()) return null;
    return data as { customerId: string; tenantId: string };
  } catch {
    return null;
  }
}

/** GET /api/v1/customers/loyalty — loyalty dashboard data */
export const GET = withRoute(async () => {
  const session = await getCustomerFromSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });

  const dashboard = await getLoyaltyDashboard(session.customerId, session.tenantId);
  return ok(dashboard);
});
