import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant, getClientIp } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { domainCanReceiveMail } from '@/lib/security/email-domain';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().max(200).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email(),
});

/**
 * POST /api/v1/newsletter — public homepage signup. Upserts a Customer with
 * contactSource: 'newsletter' and explicit marketing-email consent (PECR/
 * GDPR — submitting this form is the opt-in), so subscribers immediately
 * show up as marketing-consented Contacts without a separate subscriber
 * table duplicating what Customer already tracks.
 *
 * Fake/typo'd domains are rejected right here at submit time (MX/A record
 * lookup) rather than via a confirmation-email click — once someone
 * subscribes with a real, deliverable domain they're subscribed immediately,
 * no extra step required.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const body = schema.parse(await req.json().catch(() => ({})));

  const domain = body.email.split('@')[1];
  if (!domain || !(await domainCanReceiveMail(domain))) {
    return fail('INVALID_EMAIL', "That email address doesn't look deliverable — please check for typos", { status: 400 });
  }

  const [firstName, ...rest] = (body.name || '').trim().split(/\s+/).filter(Boolean);
  const lastName = rest.join(' ') || null;

  const existing = await prisma.customer.findFirst({ where: { tenantId, email: body.email } });

  const before = existing
    ? { marketingEmailConsent: existing.marketingEmailConsent, contactSource: existing.contactSource }
    : null;

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: {
          firstName: firstName || existing.firstName,
          lastName: lastName || existing.lastName,
          marketingEmailConsent: true,
          marketingConsentUpdatedAt: new Date(),
          // Promote a hidden ad-hoc campaign recipient to a real, visible
          // contact now that they've explicitly opted in themselves.
          contactSource: existing.contactSource === 'campaign_oneoff' ? 'newsletter' : existing.contactSource,
        },
      })
    : await prisma.customer.create({
        data: {
          tenantId,
          email: body.email,
          firstName: firstName || null,
          lastName,
          contactSource: 'newsletter',
          marketingEmailConsent: true,
          marketingConsentUpdatedAt: new Date(),
        },
      });

  await auditLog({
    tenantId,
    userId: null,
    action: existing ? 'customer.consent_set' : 'customer.newsletter_signup',
    resource: 'Customer',
    resourceId: customer.id,
    before,
    after: { marketingEmailConsent: customer.marketingEmailConsent, contactSource: customer.contactSource },
    metadata: { source: 'homepage_newsletter' },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  return ok({ subscribed: true }, { status: existing ? 200 : 201 });
}, { rateLimit: 'ipUnauth' });
