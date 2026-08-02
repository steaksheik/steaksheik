import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { resolveTenantId } from '@/lib/tenant';
import { getClientIp } from '@/lib/auth/context';
import { auditLog } from '@/lib/audit/service';
import { randomToken } from '@/lib/security/crypto';
import { getSiteUrl } from '@/lib/seo';
import { sendAdminPasswordResetEmail } from '@/lib/notifications/email-service';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const schema = z.object({ email: z.string().email() });

/**
 * POST /api/v1/auth/password/forgot — public. Always returns the same
 * generic response regardless of whether the email matched a user, so this
 * can't be used to enumerate admin accounts.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const body = schema.parse(await req.json().catch(() => ({})));
  const tenantId = await resolveTenantId(req);
  if (!tenantId) throw Errors.notFound('Tenant not found');

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: body.email.toLowerCase() } },
  });

  // Only issue a link for accounts that can actually still sign in (or are
  // mid-invite) — a deactivated/suspended account shouldn't be reactivatable
  // just by requesting a reset.
  if (user && (user.status === 'ACTIVE' || user.status === 'PENDING_VERIFICATION')) {
    const resetToken = randomToken();
    const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await prisma.user.update({ where: { id: user.id }, data: { resetToken, resetTokenExpiresAt } });

    sendAdminPasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      resetUrl: `${getSiteUrl()}/admin/reset-password?token=${resetToken}`,
    }).catch(() => {});

    await auditLog({
      tenantId,
      userId: null,
      action: 'user.password_reset_requested',
      resource: 'User',
      resourceId: user.id,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
    });
  }

  return ok({ message: 'If an account exists for that email, a reset link has been sent.' });
}, { rateLimit: 'auth' });
