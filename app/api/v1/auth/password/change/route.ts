import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { destroyAllUserSessions } from '@/lib/auth/session';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requireAuth(req);
  const body = schema.parse(await req.json().catch(() => ({})));

  const user = await prisma.user.findUnique({ where: { id: ctx.session.userId } });
  if (!user) throw Errors.notFound('User not found');
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw Errors.invalidCredentials('Current password is incorrect');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(body.newPassword) },
  });
  await destroyAllUserSessions(user.id);
  await auditLog({
    tenantId: ctx.tenantId,
    userId: user.id,
    action: 'user.password_changed',
    resource: 'User',
    resourceId: user.id,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return ok({ changed: true });
});
