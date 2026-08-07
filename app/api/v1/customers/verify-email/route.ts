import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { getClientIp } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

const schema = z.object({ token: z.string().min(1) });

/** POST /api/v1/customers/verify-email — public, consumes an emailVerifyToken minted at registration/resend. */
export const POST = withRoute(async (req: NextRequest) => {
  const body = schema.parse(await req.json().catch(() => ({})));

  const customer = await prisma.customer.findUnique({ where: { emailVerifyToken: body.token } });
  if (!customer || !customer.emailVerifyTokenExpiresAt || customer.emailVerifyTokenExpiresAt.getTime() < Date.now()) {
    return fail('INVALID_TOKEN', 'This link is invalid or has expired', { status: 400 });
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { emailVerified: true, emailVerifyToken: null, emailVerifyTokenExpiresAt: null },
  });

  await auditLog({
    tenantId: customer.tenantId,
    userId: null,
    action: 'customer.email_verified',
    resource: 'Customer',
    resourceId: customer.id,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  return ok({ email: customer.email });
}, { rateLimit: 'auth' });
