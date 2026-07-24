import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { auditLog } from '@/lib/audit/service';
import { getClientIp } from '@/lib/auth/context';

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
  marketingEmailConsent: z.boolean().optional(),
  marketingSmsConsent: z.boolean().optional(),
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
    marketingEmailConsent: customer.marketingEmailConsent,
    marketingSmsConsent: customer.marketingSmsConsent,
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

  const consentChanged =
    body.marketingEmailConsent !== undefined || body.marketingSmsConsent !== undefined;
  const before = consentChanged
    ? await prisma.customer.findUnique({
        where: { id: session.customerId },
        select: { marketingEmailConsent: true, marketingSmsConsent: true },
      })
    : null;

  const updated = await prisma.customer.update({
    where: { id: session.customerId },
    data: consentChanged ? { ...body, marketingConsentUpdatedAt: new Date() } : body,
  });

  if (consentChanged && before) {
    await auditLog({
      tenantId: session.tenantId,
      userId: null,
      action: 'customer.consent_set',
      resource: 'Customer',
      resourceId: session.customerId,
      before,
      after: { marketingEmailConsent: updated.marketingEmailConsent, marketingSmsConsent: updated.marketingSmsConsent },
      metadata: { source: 'account_settings' },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
    });
  }

  return ok({
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    marketingEmailConsent: updated.marketingEmailConsent,
    marketingSmsConsent: updated.marketingSmsConsent,
    phone: updated.phone,
  });
});
