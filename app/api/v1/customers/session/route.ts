import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { cookies } from 'next/headers';
import { CUSTOMER_SESSION_COOKIE, getCustomerSession, invalidateCustomerSessions } from '@/lib/auth/customer-session';

export const dynamic = 'force-dynamic';

/** GET /api/v1/customers/session — get current customer session (returns null data if not logged in) */
export const GET = withRoute(async () => {
  const session = await getCustomerSession();
  if (!session) return ok(null);
  return ok({
    customerId: session.customerId,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
  });
});

/** DELETE /api/v1/customers/session — logout, invalidating the session server-side */
export const DELETE = withRoute(async () => {
  const session = await getCustomerSession();
  if (session) {
    await invalidateCustomerSessions(session.customerId);
  }
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
  return ok({ message: 'Logged out' });
});
