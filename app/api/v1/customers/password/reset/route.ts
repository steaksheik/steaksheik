import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { auditLog } from '@/lib/audit/service';
import { getClientIp } from '@/lib/auth/context';
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_TTL_MS,
  encodeCustomerSessionCookie,
  invalidateCustomerSessions,
} from '@/lib/auth/customer-session';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

/** POST /api/v1/customers/password/reset — public, consumes a resetToken minted by reset-request. */
export const POST = withRoute(async (req: NextRequest) => {
  const body = schema.parse(await req.json().catch(() => ({})));

  const customer = await prisma.customer.findUnique({ where: { resetToken: body.token } });
  if (!customer || !customer.resetTokenExpiresAt || customer.resetTokenExpiresAt.getTime() < Date.now()) {
    return fail('INVALID_TOKEN', 'This link is invalid or has expired', { status: 400 });
  }

  const newHash = await bcrypt.hash(body.newPassword, 12);
  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash: newHash, resetToken: null, resetTokenExpiresAt: null },
  });

  // Invalidate every existing session (this and any other device/copy of a
  // possibly-compromised cookie), then re-issue a fresh one so the device
  // that completed the reset lands logged in — same pattern as the
  // self-service change-password route.
  await invalidateCustomerSessions(customer.id);
  const refreshed = await prisma.customer.findUnique({
    where: { id: customer.id },
    select: { sessionVersion: true, tenantId: true },
  });

  const cookieValue = encodeCustomerSessionCookie({
    customerId: customer.id,
    tenantId: refreshed?.tenantId ?? customer.tenantId,
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

  await auditLog({
    tenantId: customer.tenantId,
    userId: null,
    action: 'customer.password_reset',
    resource: 'Customer',
    resourceId: customer.id,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  return ok({ id: customer.id, email: customer.email });
}, { rateLimit: 'auth' });
