import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { publicTenant, getClientIp } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { randomToken } from '@/lib/security/crypto';
import { getSiteUrl } from '@/lib/seo';
import { sendCustomerPasswordResetEmail } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const schema = z.object({ email: z.string().email() });

/**
 * POST /api/v1/customers/password/reset-request — public. Always returns
 * the same generic response regardless of whether the email matched, so
 * this can't be used to enumerate customer accounts.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const body = schema.parse(await req.json().catch(() => ({})));
  const tenantId = await publicTenant(req);

  const customer = await prisma.customer.findUnique({
    where: { tenantId_email: { tenantId, email: body.email.toLowerCase() } },
  });

  // email is nullable (imported/SMS-only contacts) and a customer with no
  // passwordHash never had a password to reset in the first place.
  if (customer && customer.email && customer.passwordHash && customer.status === 'ACTIVE') {
    const resetToken = randomToken();
    const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await prisma.customer.update({ where: { id: customer.id }, data: { resetToken, resetTokenExpiresAt } });

    sendCustomerPasswordResetEmail({
      email: customer.email,
      firstName: customer.firstName ?? '',
      resetUrl: `${getSiteUrl()}/account/reset-password?token=${resetToken}`,
    }).catch(() => {});

    await auditLog({
      tenantId,
      userId: null,
      action: 'customer.password_reset_requested',
      resource: 'Customer',
      resourceId: customer.id,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
    });
  }

  return ok({ message: 'If an account exists for that email, a reset link has been sent.' });
}, { rateLimit: 'auth' });
