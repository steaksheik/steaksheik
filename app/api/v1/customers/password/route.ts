import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

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

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

/** PUT /api/v1/customers/password — change password */
export const PUT = withRoute(async (req: NextRequest) => {
  const session = await getCustomerFromSession();
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

  return ok({ message: 'Password updated successfully' });
});
