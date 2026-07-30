
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

export const CUSTOMER_SESSION_COOKIE = 'dk_customer_session';
export const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CustomerSessionData {
  customerId: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
}

/** Build the cookie value for a freshly-authenticated customer. */
export function encodeCustomerSessionCookie(data: CustomerSessionData & { sessionVersion: number }): string {
  const payload = JSON.stringify({ ...data, exp: Date.now() + CUSTOMER_SESSION_TTL_MS });
  return Buffer.from(payload).toString('base64');
}

/**
 * Reads the customer session cookie and verifies it against the customer's
 * current sessionVersion in the database — a cookie minted before the
 * customer's last logout or password change is rejected even though the
 * cookie itself is still present and unexpired, since logout/password-change
 * bump sessionVersion server-side.
 */
export async function getCustomerSession(): Promise<CustomerSessionData | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!raw) return null;

  let parsed: (CustomerSessionData & { exp: number; sessionVersion: number }) | null = null;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64').toString());
  } catch {
    return null;
  }
  if (!parsed || parsed.exp < Date.now()) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.customerId },
    select: { sessionVersion: true, status: true },
  });
  if (!customer || customer.status !== 'ACTIVE') return null;
  if (customer.sessionVersion !== parsed.sessionVersion) return null;

  return {
    customerId: parsed.customerId,
    tenantId: parsed.tenantId,
    email: parsed.email,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
  };
}

/** Invalidate every outstanding session for this customer (logout, password change). */
export async function invalidateCustomerSessions(customerId: string): Promise<void> {
  await prisma.customer.update({
    where: { id: customerId },
    data: { sessionVersion: { increment: 1 } },
  });
}
