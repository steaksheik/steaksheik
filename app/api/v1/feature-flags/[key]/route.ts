import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { isEnabled, getVariant, invalidate } from '@/lib/feature-flags/service';
import { auditLog } from '@/lib/audit/service';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'feature_flags:flags:read');
  const key = String(params?.key ?? '');
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) throw Errors.notFound(`Flag ${key} not found`);
  const value =
    flag.type === 'VARIANT'
      ? await getVariant(ctx.tenantId, key)
      : await isEnabled(ctx.tenantId, key);
  return ok({ key, type: flag.type, resolvedValue: value });
});

const updateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  defaultValue: z.unknown().optional(),
  isActive: z.boolean().optional(),
});

export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'feature_flags:flags:write');
  const key = String(params?.key ?? '');
  const body = updateSchema.parse(await req.json().catch(() => ({})));
  const existing = await prisma.featureFlag.findUnique({ where: { key } });
  if (!existing) throw Errors.notFound(`Flag ${key} not found`);

  const flag = await prisma.featureFlag.update({
    where: { key },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.defaultValue !== undefined ? { defaultValue: body.defaultValue as never } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      version: { increment: 1 },
    },
  });
  await invalidate(ctx.tenantId);
  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'feature_flag.updated',
    resource: 'FeatureFlag',
    resourceId: key,
    before: { defaultValue: existing.defaultValue, isActive: existing.isActive },
    after: { defaultValue: flag.defaultValue, isActive: flag.isActive },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'core.feature_flag.toggled',
  });
  return ok({ flag });
});

export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'feature_flags:flags:write');
  const key = String(params?.key ?? '');
  await prisma.featureFlag.delete({ where: { key } }).catch(() => {
    throw Errors.notFound(`Flag ${key} not found`);
  });
  await invalidate(ctx.tenantId);
  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'feature_flag.deleted',
    resource: 'FeatureFlag',
    resourceId: key,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return ok({ key, deleted: true });
});
