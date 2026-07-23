import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { cache } from '@/lib/cache/redis';
import { publishEvent } from '@/lib/events/bus';
import { logger } from '@/lib/logger';

/**
 * Feature Flag Service. Resolution: tenant override > global default.
 * Types: BOOLEAN | PERCENTAGE (consistent hash rollout) | VARIANT.
 */

const FLAG_TTL = 120; // 2 min

interface ResolvedFlag {
  key: string;
  type: string;
  value: boolean | number | string;
}

function cacheKey(tenantId: string): string {
  return `flags:${tenantId}`;
}

/** Consistent 0-99 bucket for a tenant+flag pair. */
function bucket(tenantId: string, key: string): number {
  const hash = crypto.createHash('sha256').update(`${tenantId}:${key}`).digest('hex');
  const int = parseInt(hash.slice(0, 8), 16);
  return int % 100;
}

export async function getAllFlags(tenantId: string): Promise<Record<string, boolean | string>> {
  try {
    const cached = await cache.get(cacheKey(tenantId));
    if (cached) return JSON.parse(cached) as Record<string, boolean | string>;
  } catch {
    /* fall through */
  }

  const out: Record<string, boolean | string> = {};
  try {
    const flags = await prisma.featureFlag.findMany({
      where: { isActive: true },
      include: { overrides: { where: { tenantId } } },
    });
    for (const f of flags ?? []) {
      const override = f.overrides?.[0];
      const raw = override ? override.value : f.defaultValue;
      out[f.key] = evaluate(tenantId, f.key, f.type, raw);
    }
  } catch (err) {
    logger.error('getAllFlags failed', { tenantId, error: String(err) });
  }

  try {
    await cache.set(cacheKey(tenantId), JSON.stringify(out), FLAG_TTL);
  } catch {
    /* ignore */
  }
  return out;
}

function evaluate(
  tenantId: string,
  key: string,
  type: string,
  raw: unknown
): boolean | string {
  if (type === 'PERCENTAGE') {
    const pct = typeof raw === 'number' ? raw : Number(raw ?? 0);
    return bucket(tenantId, key) < pct;
  }
  if (type === 'VARIANT') {
    return typeof raw === 'string' ? raw : String(raw ?? '');
  }
  // BOOLEAN
  return Boolean(raw);
}

export async function isEnabled(tenantId: string, key: string): Promise<boolean> {
  const all = await getAllFlags(tenantId);
  return Boolean(all?.[key]);
}

export async function getVariant(tenantId: string, key: string): Promise<string | null> {
  const all = await getAllFlags(tenantId);
  const v = all?.[key];
  return typeof v === 'string' ? v : null;
}

export async function setOverride(
  tenantId: string,
  key: string,
  value: unknown,
  userId?: string
): Promise<void> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) throw new Error(`Feature flag not found: ${key}`);
  await prisma.featureFlagOverride.upsert({
    where: { tenantId_flagId: { tenantId, flagId: flag.id } },
    create: { tenantId, flagId: flag.id, value: value as never },
    update: { value: value as never },
  });
  await invalidate(tenantId);
  await publishEvent({
    tenantId,
    type: 'core.feature_flag.toggled',
    aggregateId: key,
    aggregateType: 'FeatureFlag',
    payload: { key, newValue: value, scope: 'tenant' },
    userId,
  }).catch(() => undefined);
}

export async function removeOverride(tenantId: string, key: string): Promise<void> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) return;
  await prisma.featureFlagOverride
    .deleteMany({ where: { tenantId, flagId: flag.id } })
    .catch(() => undefined);
  await invalidate(tenantId);
}

export async function invalidate(tenantId: string): Promise<void> {
  await cache.del(cacheKey(tenantId)).catch(() => undefined);
}

export const FeatureFlagService = {
  isEnabled,
  getVariant,
  getAllFlags,
  setOverride,
  removeOverride,
  invalidate,
};
