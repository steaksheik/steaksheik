
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { getClientIp } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(1),
  channel: z.enum(['email', 'sms', 'all']),
});

/**
 * POST /api/v1/unsubscribe — public, no login required. Every marketing
 * email/SMS this project sends must link/reference this so opting out is
 * always at least as easy as opting in (PECR/GDPR requirement). The token is
 * a per-customer UUID, not a login credential, so knowing it only lets
 * someone unsubscribe that one customer — nothing else.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const body = schema.parse(await req.json().catch(() => ({})));
  const customer = await prisma.customer.findUnique({ where: { unsubscribeToken: body.token } });
  if (!customer) return fail('NOT_FOUND', 'Invalid or expired unsubscribe link', { status: 404 });

  const before = { marketingEmailConsent: customer.marketingEmailConsent, marketingSmsConsent: customer.marketingSmsConsent };
  const data =
    body.channel === 'email'
      ? { marketingEmailConsent: false }
      : body.channel === 'sms'
        ? { marketingSmsConsent: false }
        : { marketingEmailConsent: false, marketingSmsConsent: false };

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { ...data, marketingConsentUpdatedAt: new Date() },
  });

  await auditLog({
    tenantId: customer.tenantId,
    userId: null,
    action: 'customer.consent_set',
    resource: 'Customer',
    resourceId: customer.id,
    before,
    after: { marketingEmailConsent: updated.marketingEmailConsent, marketingSmsConsent: updated.marketingSmsConsent },
    metadata: { source: 'unsubscribe_link', channel: body.channel },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  return ok({ unsubscribed: true, channel: body.channel });
}, { rateLimit: 'ipUnauth' });
