import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/v1/marketing/audience — consented-customer counts for campaign composers. */
export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'notifications:settings:read');

  // campaign_oneoff contacts (ad-hoc recipients added at send time) are
  // deliberately excluded — they were never meant to become standing
  // subscribers, so they shouldn't inflate the auto-picked audience count.
  const [emailConsented, smsConsented, totalCustomers] = await Promise.all([
    prisma.customer.count({ where: { tenantId: ctx.tenantId, marketingEmailConsent: true, contactSource: { not: 'campaign_oneoff' } } }),
    prisma.customer.count({ where: { tenantId: ctx.tenantId, marketingSmsConsent: true, phone: { not: null }, contactSource: { not: 'campaign_oneoff' } } }),
    prisma.customer.count({ where: { tenantId: ctx.tenantId, contactSource: { not: 'campaign_oneoff' } } }),
  ]);

  return ok({ emailConsented, smsConsented, totalCustomers });
});
