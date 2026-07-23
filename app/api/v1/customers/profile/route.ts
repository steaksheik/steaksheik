import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
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
    return data as { customerId: string; tenantId: string; email: string; firstName: string; lastName: string };
  } catch {
    return null;
  }
}

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
});

/** GET /api/v1/customers/profile — get full profile */
export const GET = withRoute(async () => {
  const session = await getCustomerFromSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    include: { addresses: { orderBy: { isDefault: 'desc' } } },
  });
  if (!customer) return fail('NOT_FOUND', 'Customer not found', { status: 404 });

  return ok({
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    status: customer.status,
    createdAt: customer.createdAt,
    addresses: customer.addresses.map(a => ({
      id: a.id,
      label: a.label,
      firstName: a.firstName,
      lastName: a.lastName,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      county: a.county,
      postcode: a.postcode,
      country: a.country,
      phone: a.phone,
      isDefault: a.isDefault,
    })),
  });
});

/** PUT /api/v1/customers/profile — update profile */
export const PUT = withRoute(async (req: NextRequest) => {
  const session = await getCustomerFromSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });

  const body = updateSchema.parse(await req.json());

  const updated = await prisma.customer.update({
    where: { id: session.customerId },
    data: body,
  });

  return ok({
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    phone: updated.phone,
  });
});
