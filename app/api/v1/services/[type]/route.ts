import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';
import { encryptCredentials, maskCredentials, decryptCredentials } from '@/lib/security/crypto';
import { pluginRegistry } from '@/lib/plugins/registry';
import { PlatformServiceType } from '@/lib/plugins/types';

export const dynamic = 'force-dynamic';

const SERVICE_TYPES = new Set(['EMAIL', 'SMS', 'STORAGE', 'CDN', 'PAYMENT', 'MAPS', 'ANALYTICS_GA4', 'ANALYTICS_GTM', 'ANALYTICS_PH', 'DNS_CDN', 'ERROR_TRACKING', 'UPTIME']);

function typeOf(params?: Record<string, string | string[]>): PlatformServiceType {
  const t = params?.type;
  const v = (Array.isArray(t) ? t[0] : t ?? '').toUpperCase();
  if (!SERVICE_TYPES.has(v)) throw Errors.notFound('Unknown service type');
  return v as PlatformServiceType;
}

export const GET = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'services:platform:read');
  const type = typeOf(params);
  const svc = await prisma.platformService.findUnique({ where: { tenantId_serviceType: { tenantId: ctx.tenantId, serviceType: type as never } } });
  if (!svc) return ok({ service: { serviceType: type, configured: false, status: 'UNCONFIGURED', isEnabled: false } });
  return ok({ service: { ...svc, credentials: maskCredentials((svc.credentials ?? {}) as Record<string, unknown>) } });
});

const putSchema = z.object({
  adapterType: z.string().min(1),
  displayName: z.string().optional(),
  credentials: z.record(z.unknown()).default({}),
  config: z.record(z.unknown()).optional(),
});

export const PUT = withRoute(async (req, { params }) => {
  const ctx = await requirePermission(req as NextRequest, 'services:platform:write');
  const type = typeOf(params);
  const body = putSchema.parse(await (req as NextRequest).json().catch(() => ({})));

  // Load any existing record so blank secret fields on re-save preserve their
  // previously stored values (the UI only sends fields the admin actually filled).
  const existing = await prisma.platformService.findUnique({
    where: { tenantId_serviceType: { tenantId: ctx.tenantId, serviceType: type as never } },
  });
  const existingCreds = existing ? decryptCredentials((existing.credentials ?? {}) as Record<string, unknown>) : {};
  const existingConfig = (existing?.config ?? {}) as Record<string, unknown>;

  const mergedCreds = { ...existingCreds, ...(body.credentials ?? {}) };
  const mergedConfig = { ...existingConfig, ...(body.config ?? {}) };
  const encrypted = encryptCredentials(mergedCreds);

  const svc = await prisma.platformService.upsert({
    where: { tenantId_serviceType: { tenantId: ctx.tenantId, serviceType: type as never } },
    update: { adapterType: body.adapterType, displayName: body.displayName ?? type, credentials: encrypted as never, config: mergedConfig as never, status: 'CONFIGURED' },
    create: { tenantId: ctx.tenantId, serviceType: type as never, adapterType: body.adapterType, displayName: body.displayName ?? type, credentials: encrypted as never, config: mergedConfig as never, status: 'CONFIGURED', isEnabled: false },
  });
  // Adapters receive non-secret config (provider, host, region, fromEmail…)
  // merged with decrypted credentials so provider selection is respected.
  await pluginRegistry.reconfigure(type, { ...mergedConfig, ...mergedCreds });
  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: 'service.configured', resource: 'PlatformService', resourceId: type, after: { adapterType: body.adapterType, provider: mergedConfig.provider }, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  return ok({ service: { ...svc, credentials: maskCredentials((svc.credentials ?? {}) as Record<string, unknown>) } });
});
