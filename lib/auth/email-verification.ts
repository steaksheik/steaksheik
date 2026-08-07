import { randomToken } from '@/lib/security/crypto';
import { getSiteUrl } from '@/lib/seo';
import { sendCustomerVerificationEmail } from '@/lib/notifications/email-service';

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Mint a fresh emailVerifyToken/expiry pair and fire the confirmation email
 * (fire-and-forget — must never block the caller's write). Shared by
 * registration, newsletter signup and the resend endpoint so all three
 * entry points that can create/refresh an unverified Customer address stay
 * in sync on TTL and email copy.
 */
export function issueEmailVerification(params: { email: string; firstName?: string | null }): {
  emailVerifyToken: string;
  emailVerifyTokenExpiresAt: Date;
} {
  const emailVerifyToken = randomToken();
  const emailVerifyTokenExpiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
  sendCustomerVerificationEmail({
    email: params.email,
    firstName: params.firstName ?? 'there',
    verifyUrl: `${getSiteUrl()}/account/verify-email?token=${emailVerifyToken}`,
  }).catch(() => {});
  return { emailVerifyToken, emailVerifyTokenExpiresAt };
}
