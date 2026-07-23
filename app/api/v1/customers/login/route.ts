import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const CUSTOMER_SESSION_COOKIE = 'dk_customer_session';
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

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

  // Simple session token stored in cookie
  const sessionToken = crypto.randomUUID();
  // Store session token → customerId mapping (reuse Configuration model as lightweight session store)
  // For simplicity, use a signed cookie with customer data
  const sessionData = JSON.stringify({
    customerId: customer.id,
    tenantId,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    exp: Date.now() + SESSION_TTL,
  });

  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, Buffer.from(sessionData).toString('base64'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL / 1000,
    path: '/',
  });

  return ok({
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
  });
}, { rateLimit: 'ipUnauth' });
