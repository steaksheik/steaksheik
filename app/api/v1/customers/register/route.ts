import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant, getClientIp } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sendWelcomeEmail } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  // PECR/GDPR: marketing consent is opt-in and never assumed. Both default
  // false so an omitted field (older clients, API callers) never accidentally
  // opts someone in.
  marketingEmailConsent: z.boolean().optional().default(false),
  marketingSmsConsent: z.boolean().optional().default(false),
});

/** POST /api/v1/customers/register — customer self-registration */
export const POST = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const body = registerSchema.parse(await req.json());

  // Check if already exists
  const existing = await prisma.customer.findUnique({
    where: { tenantId_email: { tenantId, email: body.email.toLowerCase() } },
  });
  if (existing) return fail('CONFLICT', 'An account with this email already exists', { status: 409 });

  const passwordHash = await bcrypt.hash(body.password, 12);

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      email: body.email.toLowerCase(),
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      marketingEmailConsent: body.marketingEmailConsent,
      marketingSmsConsent: body.marketingSmsConsent,
      marketingConsentUpdatedAt: new Date(),
    },
  });

  // Record the consent decision itself (even "declined") — PECR/GDPR
  // accountability requires being able to show when/how consent was set.
  await auditLog({
    tenantId,
    userId: null,
    action: 'customer.consent_set',
    resource: 'Customer',
    resourceId: customer.id,
    after: { marketingEmailConsent: body.marketingEmailConsent, marketingSmsConsent: body.marketingSmsConsent },
    metadata: { source: 'registration' },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  // Send welcome email (fire-and-forget)
    sendWelcomeEmail({
    email: body.email.toLowerCase(),
    firstName: customer.firstName ?? 'there',
  }).catch(() => {});

  return ok({
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
  }, { status: 201 });
}, { rateLimit: 'ipUnauth' });
