import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/customers — list all customers for the tenant */
export const GET = withRoute(async (req) => {
  const auth = await requirePermission(req, 'ordering:customers:read');

  const customers = await prisma.customer.findMany({
    // campaign_oneoff = an ad-hoc recipient added directly in a campaign send,
    // never saved as a visible/standing customer — keep them out of this list.
    where: { tenantId: auth.tenantId, contactSource: { not: 'campaign_oneoff' } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      marketingEmailConsent: true,
      marketingSmsConsent: true,
      contactSource: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return ok(customers);
});

const addContactSchema = z
  .object({
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
    phone: z.string().trim().min(4).max(30).optional().or(z.literal('')),
    emailConsent: z.boolean().default(false),
    smsConsent: z.boolean().default(false),
    consentNote: z.string().trim().max(500).optional(),
  })
  .transform((v) => ({ ...v, email: v.email || undefined, phone: v.phone || undefined }));

/**
 * POST /api/v1/admin/customers — add a contact who isn't a registered
 * customer (e.g. from a paper sign-up sheet), for use in marketing
 * campaigns. Consent is recorded exactly as the admin declares it — never
 * inferred — and a consentNote is required whenever a consent box is
 * ticked so there's an audit trail of how it was obtained (PECR/GDPR).
 */
export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'ordering:customers:write');
  const body = addContactSchema.parse(await req.json().catch(() => ({})));

  if (!body.email && !body.phone) {
    return fail('VALIDATION_ERROR', 'An email address or phone number is required', { status: 400 });
  }
  if (body.emailConsent && !body.email) {
    return fail('VALIDATION_ERROR', 'Email consent requires an email address', { status: 400 });
  }
  if (body.smsConsent && !body.phone) {
    return fail('VALIDATION_ERROR', 'SMS consent requires a phone number', { status: 400 });
  }
  if ((body.emailConsent || body.smsConsent) && !body.consentNote?.trim()) {
    return fail('VALIDATION_ERROR', 'Please note how/where this contact gave consent (e.g. "Signed up at till, 12 Jul 2026")', { status: 400 });
  }

  // De-dupe against an existing customer with the same email (or, for
  // phone-only contacts with no email, the same phone) rather than creating
  // a second row that would double-send campaigns.
  const existing = body.email
    ? await prisma.customer.findFirst({ where: { tenantId: ctx.tenantId, email: body.email } })
    : await prisma.customer.findFirst({ where: { tenantId: ctx.tenantId, email: null, phone: body.phone } });

  const before = existing
    ? { marketingEmailConsent: existing.marketingEmailConsent, marketingSmsConsent: existing.marketingSmsConsent }
    : null;

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: {
          firstName: body.firstName || existing.firstName,
          lastName: body.lastName || existing.lastName,
          phone: body.phone || existing.phone,
          marketingEmailConsent: body.emailConsent || existing.marketingEmailConsent,
          marketingSmsConsent: body.smsConsent || existing.marketingSmsConsent,
          marketingConsentUpdatedAt: new Date(),
          // Promote a previously-hidden ad-hoc campaign recipient to a real,
          // visible contact now that an admin has explicitly added them.
          contactSource: existing.contactSource === 'campaign_oneoff' ? 'manual' : existing.contactSource,
        },
      })
    : await prisma.customer.create({
        data: {
          tenantId: ctx.tenantId,
          email: body.email ?? null,
          firstName: body.firstName || null,
          lastName: body.lastName || null,
          phone: body.phone || null,
          contactSource: 'manual',
          marketingEmailConsent: body.emailConsent,
          marketingSmsConsent: body.smsConsent,
          marketingConsentUpdatedAt: body.emailConsent || body.smsConsent ? new Date() : null,
        },
      });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: existing ? 'customer.consent_set' : 'customer.manual_add',
    resource: 'Customer',
    resourceId: customer.id,
    before,
    after: { marketingEmailConsent: customer.marketingEmailConsent, marketingSmsConsent: customer.marketingSmsConsent },
    metadata: { source: 'admin_manual', consentNote: body.consentNote ?? null },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ customer }, { status: existing ? 200 : 201 });
});
