import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']),
});

function getId(params?: Record<string, string | string[]>): string {
  const id = params?.id;
  return (Array.isArray(id) ? id[0] : id) ?? '';
}

/** PATCH /api/v1/contact/[id] — admin: change a message's status. */
export const PATCH = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'support:messages:write');
  const id = getId(params);
  const body = updateSchema.parse(await req.json().catch(() => ({})));

  const existing = await prisma.contactMessage.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) return fail('NOT_FOUND', 'Message not found', { status: 404 });

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { status: body.status },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'support.message.status_changed',
    resource: 'ContactMessage',
    resourceId: id,
    before: { status: existing.status },
    after: { status: updated.status },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok(updated);
});

/** DELETE /api/v1/contact/[id] — admin: permanently remove a message (spam cleanup). */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'support:messages:write');
  const id = getId(params);

  const existing = await prisma.contactMessage.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) return fail('NOT_FOUND', 'Message not found', { status: 404 });

  await prisma.contactMessage.delete({ where: { id } });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'support.message.deleted',
    resource: 'ContactMessage',
    resourceId: id,
    before: { name: existing.name, email: existing.email, subject: existing.subject },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ deleted: true });
});
