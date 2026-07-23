import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const CUSTOMER_SESSION_COOKIE = 'dk_customer_session';

/** GET /api/v1/customers/session — get current customer session (returns null data if not logged in) */
export const GET = withRoute(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!raw) return ok(null);

  try {
    const data = JSON.parse(Buffer.from(raw, 'base64').toString());
    if (data.exp < Date.now()) {
      return ok(null);
    }
    return ok({
      customerId: data.customerId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
    });
  } catch {
    return ok(null);
  }
});

/** DELETE /api/v1/customers/session — logout */
export const DELETE = withRoute(async () => {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
  return ok({ message: 'Logged out' });
});
