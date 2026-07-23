import { prisma } from '@/lib/db';
import { cache } from '@/lib/cache/redis';
import { validateConfigValue } from '@/lib/config/schemas';
import { ApiError } from '@/lib/api/errors';
import { encrypt, decrypt } from '@/lib/security/crypto';
import { publishEvent } from '@/lib/events/bus';
import { logger } from '@/lib/logger';

/**
 * Configuration Service — hierarchical resolution:
 *   Tenant Override  >  Platform Default (tenantId = null)
 * Secrets (isSecret) are ENV-overridable and encrypted at rest in DB.
 * Two-tier cache: in-memory LRU (via cache abstraction) backed by Redis-style store.
 */

const CONFIG_TTL = 300; // 5 min
const CONFIG_CHANNEL = 'config:invalidate';

function moduleCacheKey(tenantId: string | null, module: string): string {
  return `config:${tenantId ?? 'platform'}:${module}`;
}

interface ConfigRow {
  key: string;
  value: unknown;
  type: string;
  isPublic: boolean;
  isSecret: boolean;
}

function decodeValue(row: ConfigRow): unknown {
  if (row.isSecret && typeof row.value === 'string') {
    return decrypt(row.value);
  }
  return row.value;
}

async function loadModule(tenantId: string | null, module: string): Promise<Record<string, ConfigRow>> {
  const rows = await prisma.configuration.findMany({
    where: { tenantId, module },
  });
  const map: Record<string, ConfigRow> = {};
  for (const r of rows ?? []) {
    map[r.key] = {
      key: r.key,
      value: r.value,
      type: r.type,
      isPublic: r.isPublic,
      isSecret: r.isSecret,
    };
  }
  return map;
}

/** Resolve merged module config (platform defaults + tenant overrides). */
export async function getModule(
  tenantId: string,
  module: string
): Promise<Record<string, unknown>> {
  const cacheKey = moduleCacheKey(tenantId, module);
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached) as Record<string, unknown>;
  } catch {
    /* fall through */
  }

  let platform: Record<string, ConfigRow> = {};
  let tenant: Record<string, ConfigRow> = {};
  try {
    [platform, tenant] = await Promise.all([
      loadModule(null, module),
      loadModule(tenantId, module),
    ]);
  } catch (err) {
    logger.error('config getModule DB error', { module, error: String(err) });
  }

  const merged: Record<string, unknown> = {};
  for (const [k, row] of Object.entries(platform)) merged[k] = decodeValue(row);
  for (const [k, row] of Object.entries(tenant)) merged[k] = decodeValue(row);

  try {
    await cache.set(cacheKey, JSON.stringify(merged), CONFIG_TTL);
  } catch {
    /* ignore */
  }
  return merged;
}

export async function get<T = unknown>(
  tenantId: string,
  module: string,
  key: string
): Promise<T | undefined> {
  const mod = await getModule(tenantId, module);
  return mod?.[key] as T | undefined;
}

/** Only public keys — safe for storefront. */
export async function getPublic(
  tenantId: string,
  module: string
): Promise<Record<string, unknown>> {
  let platform: Record<string, ConfigRow> = {};
  let tenant: Record<string, ConfigRow> = {};
  try {
    [platform, tenant] = await Promise.all([
      loadModule(null, module),
      loadModule(tenantId, module),
    ]);
  } catch (err) {
    logger.error('config getPublic DB error', { module, error: String(err) });
  }
  const out: Record<string, unknown> = {};
  for (const [k, row] of Object.entries(platform)) if (row.isPublic) out[k] = decodeValue(row);
  for (const [k, row] of Object.entries(tenant)) if (row.isPublic) out[k] = decodeValue(row);
  return out;
}

export async function set(params: {
  tenantId: string;
  module: string;
  key: string;
  value: unknown;
  type?: string;
  isPublic?: boolean;
  isSecret?: boolean;
  userId?: string;
}): Promise<{ oldValue: unknown; newValue: unknown }> {
  const { tenantId, module, key } = params;
  const validation = validateConfigValue(module, key, params.value);
  if (!validation.valid) {
    throw new ApiError('VALIDATION_ERROR', `Invalid value for ${module}.${key}`, validation.errors);
  }

  const existing = await prisma.configuration
    .findUnique({ where: { tenantId_module_key: { tenantId, module, key } } })
    .catch(() => null);
  const oldValue = existing ? decodeValue(existing as unknown as ConfigRow) : undefined;

  const isSecret = params.isSecret ?? existing?.isSecret ?? false;
  const storedValue = isSecret && typeof params.value === 'string' ? encrypt(params.value) : params.value;

  await prisma.configuration.upsert({
    where: { tenantId_module_key: { tenantId, module, key } },
    create: {
      tenantId,
      module,
      key,
      value: storedValue as never,
      type: (params.type ?? existing?.type ?? 'STRING') as never,
      isPublic: params.isPublic ?? existing?.isPublic ?? false,
      isSecret,
      updatedBy: params.userId ?? null,
      createdBy: params.userId ?? null,
    },
    update: {
      value: storedValue as never,
      ...(params.type ? { type: params.type as never } : {}),
      ...(params.isPublic !== undefined ? { isPublic: params.isPublic } : {}),
      isSecret,
      updatedBy: params.userId ?? null,
    },
  });

  await invalidate(tenantId, module);
  await publishEvent({
    tenantId,
    type: 'core.config.updated',
    aggregateId: `${module}.${key}`,
    aggregateType: 'Configuration',
    payload: { module, key, oldValue: isSecret ? '***' : oldValue, newValue: isSecret ? '***' : params.value },
    userId: params.userId,
  }).catch(() => undefined);

  return { oldValue, newValue: params.value };
}

/** Remove a tenant override (falls back to platform default). */
export async function reset(tenantId: string, module: string, key: string): Promise<void> {
  await prisma.configuration
    .deleteMany({ where: { tenantId, module, key } })
    .catch(() => undefined);
  await invalidate(tenantId, module);
}

export async function invalidate(tenantId: string, module: string): Promise<void> {
  await cache.del(moduleCacheKey(tenantId, module)).catch(() => undefined);
  await cache.del(moduleCacheKey(null, module)).catch(() => undefined);
  await cache.publish(CONFIG_CHANNEL, JSON.stringify({ tenantId, module })).catch(() => undefined);
}

export const ConfigService = { get, getModule, getPublic, set, reset, invalidate, validate: validateConfigValue };
