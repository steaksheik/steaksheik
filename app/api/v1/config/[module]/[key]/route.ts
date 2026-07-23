import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { get, set, reset } from '@/lib/config/service';
import { auditLog } from '@/lib/audit/service';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'config:settings:read');
  const moduleName = String(params?.module ?? '');
  const key = String(params?.key ?? '');
  const value = await get(ctx.tenantId, moduleName, key);
  if (value === undefined) throw Errors.notFound(`Config ${moduleName}.${key} not found`);
  return ok({ module: moduleName, key, value });
});

const putSchema = z.object({
  value: z.unknown(),
  type: z.string().optional(),
  isPublic: z.boolean().optional(),
  isSecret: z.boolean().optional(),
});

export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'config:settings:write');
  const moduleName = String(params?.module ?? '');
  const key = String(params?.key ?? '');
  const body = putSchema.parse(await req.json().catch(() => ({})));

  const { oldValue, newValue } = await set({
    tenantId: ctx.tenantId,
    module: moduleName,
    key,
    value: body.value,
    type: body.type,
    isPublic: body.isPublic,
    isSecret: body.isSecret,
    userId: ctx.session.userId,
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'config.updated',
    resource: 'Configuration',
    resourceId: `${moduleName}.${key}`,
    before: { value: body.isSecret ? '***' : oldValue },
    after: { value: body.isSecret ? '***' : newValue },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ module: moduleName, key, value: newValue });
});

export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'config:settings:write');
  const moduleName = String(params?.module ?? '');
  const key = String(params?.key ?? '');
  await reset(ctx.tenantId, moduleName, key);
  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'config.reset',
    resource: 'Configuration',
    resourceId: `${moduleName}.${key}`,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return ok({ module: moduleName, key, reset: true });
});
