import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'identity:audit:read');
  const id = String(params?.id ?? '');
  const entry = await prisma.auditLog.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!entry) throw Errors.notFound('Audit log entry not found');
  return ok(entry);
});
