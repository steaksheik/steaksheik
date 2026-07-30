import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_TTL_MS, encodeCustomerSessionCookie, getCustomerSession, invalidateCustomerSessions } from '@/lib/auth/customer-session';

export const dynamic = 'force-dynamic';

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

/** PUT /api/v1/customers/password — change password */
export const PUT = withRoute(async (req: NextRequest) => {
  const session = await getCustomerSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });

  const body = changePasswordSchema.parse(await req.json());

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
  });
  if (!customer || !customer.passwordHash) {
    return fail('NOT_FOUND', 'Customer not found', { status: 404 });
  }

  const valid = await bcrypt.compare(body.currentPassword, customer.passwordHash);
  if (!valid) {
    return fail('INVALID_CREDENTIALS', 'Current password is incorrect', { status: 400 });
  }

  const newHash = await bcrypt.hash(body.newPassword, 12);
  await prisma.customer.update({
    where: { id: session.customerId },
    data: { passwordHash: newHash },
  });

  // Invalidate every session (this device + any other logged-in device/copy
  // of a possibly-compromised cookie), then re-issue a fresh one for the
  // device that just made this change, so the customer isn't immediately
  // logged out of their own password-change request.
  await invalidateCustomerSessions(session.customerId);
  const refreshed = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: { sessionVersion: true },
  });

  const cookieValue = encodeCustomerSessionCookie({
    customerId: customer.id,
    tenantId: session.tenantId,
    email: customer.email ?? '',
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    sessionVersion: refreshed?.sessionVersion ?? 0,
  });
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CUSTOMER_SESSION_TTL_MS / 1000,
    path: '/',
  });

  return ok({ message: 'Password updated successfully' });
});
