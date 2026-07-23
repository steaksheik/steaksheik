import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { setOverride, removeOverride } from '@/lib/feature-flags/service';
import { auditLog } from '@/lib/audit/service';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const schema = z.object({ value: z.unknown() });

export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'feature_flags:flags:write');
  const key = String(params?.key ?? '');
  const body = schema.parse(await req.json().catch(() => ({})));
  await setOverride(ctx.tenantId, key, body.value, ctx.session.userId).catch((e) => {
    throw Errors.notFound(String(e?.message ?? 'Flag not found'));
  });
  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'feature_flag.override_set',
    resource: 'FeatureFlagOverride',
    resourceId: key,
    after: { value: body.value },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return ok({ key, override: body.value });
});

export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'feature_flags:flags:write');
  const key = String(params?.key ?? '');
  await removeOverride(ctx.tenantId, key);
  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'feature_flag.override_removed',
    resource: 'FeatureFlagOverride',
    resourceId: key,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return ok({ key, overrideRemoved: true });
});
