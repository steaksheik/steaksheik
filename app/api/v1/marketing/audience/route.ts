
import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/v1/marketing/audience — consented-customer counts for campaign composers. */
export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'notifications:settings:read');

  const [emailConsented, smsConsented, totalCustomers] = await Promise.all([
    prisma.customer.count({ where: { tenantId: ctx.tenantId, marketingEmailConsent: true } }),
    prisma.customer.count({ where: { tenantId: ctx.tenantId, marketingSmsConsent: true, phone: { not: null } } }),
    prisma.customer.count({ where: { tenantId: ctx.tenantId } }),
  ]);

  return ok({ emailConsented, smsConsented, totalCustomers });
});
