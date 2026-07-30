import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_TTL_MS, encodeCustomerSessionCookie } from '@/lib/auth/customer-session';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/** POST /api/v1/customers/login — customer login */
export const POST = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const body = loginSchema.parse(await req.json());

  const customer = await prisma.customer.findUnique({
    where: { tenantId_email: { tenantId, email: body.email.toLowerCase() } },
  });
  if (!customer || !customer.passwordHash) {
    return fail('INVALID_CREDENTIALS', 'Invalid email or password', { status: 401 });
  }
  if (customer.status !== 'ACTIVE') {
    return fail('ACCOUNT_INACTIVE', 'Account is not active', { status: 403 });
  }

  const valid = await bcrypt.compare(body.password, customer.passwordHash);
  if (!valid) {
    return fail('INVALID_CREDENTIALS', 'Invalid email or password', { status: 401 });
  }

  const cookieValue = encodeCustomerSessionCookie({
    customerId: customer.id,
    tenantId,
    email: customer.email ?? '',
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    sessionVersion: customer.sessionVersion,
  });

  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CUSTOMER_SESSION_TTL_MS / 1000,
    path: '/',
  });

  return ok({
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
  });
}, { rateLimit: 'ipUnauth' });
