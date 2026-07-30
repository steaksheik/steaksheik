import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getCustomerSession } from '@/lib/auth/customer-session';

export const dynamic = 'force-dynamic';

const addressSchema = z.object({
  label: z.string().default('Home'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  county: z.string().optional(),
  postcode: z.string().min(1),
  country: z.string().default('GB'),
  phone: z.string().optional(),
  isDefault: z.boolean().default(false),
});

/** GET /api/v1/customers/addresses — list addresses */
export const GET = withRoute(async () => {
  const session = await getCustomerSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });

  const addresses = await prisma.customerAddress.findMany({
    where: { customerId: session.customerId },
    orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
  });

  return ok(addresses);
});

/** POST /api/v1/customers/addresses — add address */
export const POST = withRoute(async (req: NextRequest) => {
  const session = await getCustomerSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });

  const body = addressSchema.parse(await req.json());

  // If setting as default, unset other defaults
  if (body.isDefault) {
    await prisma.customerAddress.updateMany({
      where: { customerId: session.customerId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const address = await prisma.customerAddress.create({
    data: {
      customerId: session.customerId,
      ...body,
      line2: body.line2 ?? null,
      county: body.county ?? null,
      phone: body.phone ?? null,
    },
  });

  return ok(address, { status: 201 });
});
