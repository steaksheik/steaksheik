import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';
import { decryptCredentials } from '@/lib/security/crypto';
import { pluginRegistry } from '@/lib/plugins/registry';
import { PlatformServiceType } from '@/lib/plugins/types';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

const SERVICE_TYPES = new Set(['EMAIL', 'SMS', 'STORAGE', 'CDN', 'PAYMENT', 'MAPS', 'ANALYTICS_GA4', 'ANALYTICS_GTM', 'ANALYTICS_PH', 'DNS_CDN', 'ERROR_TRACKING', 'UPTIME']);

function typeOf(params?: Record<string, string | string[]>): PlatformServiceType {
  const t = params?.type;
  const v = (Array.isArray(t) ? t[0] : t ?? '').toUpperCase();
  if (!SERVICE_TYPES.has(v)) throw Errors.notFound('Unknown service type');
  return v as PlatformServiceType;
}

export const POST = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'services:platform:test');
  const type = typeOf(params);
  const svc = await prisma.platformService.findUnique({ where: { tenantId_serviceType: { tenantId: ctx.tenantId, serviceType: type as never } } });
  const creds = svc ? decryptCredentials((svc.credentials ?? {}) as Record<string, unknown>) : {};
  const config = (svc?.config ?? {}) as Record<string, unknown>;
  // Merge non-secret config (provider, host, fromEmail…) with credentials so
  // the test reflects the exact provider/settings selected in the backend.
  const merged = { ...config, ...creds };
  if (svc) await pluginRegistry.reconfigure(type, merged);
  const adapter = pluginRegistry.get(type);
  const result = await adapter.testConnection(merged);
  const health = await adapter.healthCheck();
  if (svc) {
    await prisma.platformService.update({
      where: { id: svc.id },
      data: { lastHealthCheck: new Date(), lastHealthStatus: health as never, status: result.success ? 'CONNECTED' : 'ERROR' },
    }).catch(() => undefined);
  }
  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: 'service.tested', resource: 'PlatformService', resourceId: type, after: { success: result.success }, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  return ok({ test: result, health, usingFallback: adapter.isFallback });
});
