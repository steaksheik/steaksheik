import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/api/errors';
import { auditLog } from '@/lib/audit/service';
import { encryptCredentials, maskCredentials, decryptCredentials, maskSecret } from '@/lib/security/crypto';
import { pluginRegistry } from '@/lib/plugins/registry';
import { PlatformServiceType } from '@/lib/plugins/types';
import { metaFor } from '@/lib/plugins/service-fields';

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

  // Return non-secret credential values in plaintext so the admin form can
  // pre-fill them (bucket, region, access key id, account SID, zone id…). Only
  // fields explicitly flagged `secret` are masked. Identifiers stored on older
  // records inside encrypted credentials are surfaced here too, so switching a
  // field to `config` never appears to "wipe" a previously saved value.
  const meta = metaFor(type);
  const secretKeys = new Set((meta?.fields ?? []).filter((f) => f.secret).map((f) => f.key));
  const decrypted = decryptCredentials((svc.credentials ?? {}) as Record<string, unknown>);
  const safeCreds: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(decrypted)) {
    safeCreds[k] = secretKeys.has(k) ? maskSecret(typeof v === 'string' ? v : String(v)) : v;
  }
  // Non-secret credential values also merged into config for form pre-fill.
  const config = { ...(svc.config as Record<string, unknown>) };
  for (const [k, v] of Object.entries(safeCreds)) {
    if (!secretKeys.has(k) && config[k] == null) config[k] = v;
  }
  return ok({ service: { ...svc, credentials: safeCreds, config } });
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
    // A field's `kind` (credential vs. config) can be reclassified between
  // releases (e.g. non-secret identifiers moved out of encrypted storage).
  // Any leftover value for a now-`config` field must be migrated out of the
  // credentials blob — otherwise the stale, possibly-rotated value keeps
  // silently overriding the fresh one whenever config+credentials are merged
  // for adapter use (`{ ...config, ...creds }` always favours credentials).
  const meta = metaFor(type);
  for (const f of meta?.fields ?? []) {
    if (f.kind === 'config' && f.key in mergedCreds) {
      if (mergedConfig[f.key] == null || mergedConfig[f.key] === '') {
        mergedConfig[f.key] = mergedCreds[f.key];
      }
      delete mergedCreds[f.key];
    }
  }
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
