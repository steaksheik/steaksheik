import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getCustomerSession } from '@/lib/auth/customer-session';

export const dynamic = 'force-dynamic';

const updateAddressSchema = z.object({
  label: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  line1: z.string().min(1).optional(),
  line2: z.string().nullable().optional(),
  city: z.string().min(1).optional(),
  county: z.string().nullable().optional(),
  postcode: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

/** PUT /api/v1/customers/addresses/:id — update address */
export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const session = await getCustomerSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });
  const id = (params as { id: string }).id;

  const existing = await prisma.customerAddress.findFirst({
    where: { id, customerId: session.customerId },
  });
  if (!existing) return fail('NOT_FOUND', 'Address not found', { status: 404 });

  const body = updateAddressSchema.parse(await req.json());

  if (body.isDefault) {
    await prisma.customerAddress.updateMany({
      where: { customerId: session.customerId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.customerAddress.update({
    where: { id },
    data: body,
  });

  return ok(updated);
});

/** DELETE /api/v1/customers/addresses/:id — delete address */
export const DELETE = withRoute(async (_req: NextRequest, { params }) => {
  const session = await getCustomerSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });
  const id = (params as { id: string }).id;

  const existing = await prisma.customerAddress.findFirst({
    where: { id, customerId: session.customerId },
  });
  if (!existing) return fail('NOT_FOUND', 'Address not found', { status: 404 });

  await prisma.customerAddress.delete({ where: { id } });

  return ok({ message: 'Address deleted' });
});
