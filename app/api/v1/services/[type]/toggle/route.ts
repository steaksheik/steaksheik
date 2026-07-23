import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';
import { PlatformServiceType } from '@/lib/plugins/types';

export const dynamic = 'force-dynamic';

const SERVICE_TYPES = new Set(['EMAIL', 'SMS', 'STORAGE', 'CDN', 'PAYMENT', 'MAPS', 'ANALYTICS_GA4', 'ANALYTICS_GTM', 'ANALYTICS_PH', 'DNS_CDN', 'ERROR_TRACKING', 'UPTIME']);

function typeOf(params?: Record<string, string | string[]>): PlatformServiceType {
  const t = params?.type;
  const v = (Array.isArray(t) ? t[0] : t ?? '').toUpperCase();
  if (!SERVICE_TYPES.has(v)) throw Errors.notFound('Unknown service type');
  return v as PlatformServiceType;
}

const schema = z.object({ enabled: z.boolean() });

export const POST = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'services:platform:write');
  const type = typeOf(params);
  const body = schema.parse(await (req as NextRequest).json().catch(() => ({})));
  const svc = await prisma.platformService.findUnique({ where: { tenantId_serviceType: { tenantId: ctx.tenantId, serviceType: type as never } } });
  if (!svc) throw Errors.notFound('Service must be configured before enabling');
  const updated = await prisma.platformService.update({ where: { id: svc.id }, data: { isEnabled: body.enabled } });
  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: body.enabled ? 'service.enabled' : 'service.disabled', resource: 'PlatformService', resourceId: type, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  return ok({ serviceType: type, isEnabled: updated.isEnabled });
});
