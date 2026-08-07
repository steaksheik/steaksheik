import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { getCustomerSession } from '@/lib/auth/customer-session';
import { issueEmailVerification } from '@/lib/auth/email-verification';

export const dynamic = 'force-dynamic';

/** POST /api/v1/customers/verify-email/resend — issue a fresh verification link for the signed-in customer. */
export const POST = withRoute(async () => {
  const session = await getCustomerSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: { id: true, email: true, firstName: true, emailVerified: true },
  });
  if (!customer?.email) return fail('NOT_FOUND', 'Customer not found', { status: 404 });
  if (customer.emailVerified) return ok({ message: 'Email already verified' });

  const { emailVerifyToken, emailVerifyTokenExpiresAt } = issueEmailVerification({
    email: customer.email,
    firstName: customer.firstName,
  });
  await prisma.customer.update({
    where: { id: customer.id },
    data: { emailVerifyToken, emailVerifyTokenExpiresAt },
  });

  return ok({ message: 'Verification email sent' });
}, { rateLimit: 'auth' });
