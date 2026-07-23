import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { cache } from '@/lib/cache/redis';
import { logger } from '@/lib/logger';

/**
 * Tenant resolution. Priority:
 *   1. X-Tenant-Id / X-Tenant-Slug header (back-office / API clients)
 *   2. Custom domain mapping (TenantDomain)
 *   3. Default tenant (single-tenant fallback)
 */

let defaultTenantIdCache: string | null = null;

export async function getDefaultTenantId(): Promise<string | null> {
  if (defaultTenantIdCache) return defaultTenantIdCache;
  try {
    const cached = await cache.get('tenant:default');
    if (cached) {
      defaultTenantIdCache = cached;
      return cached;
    }
    const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (tenant) {
      defaultTenantIdCache = tenant.id;
      await cache.set('tenant:default', tenant.id, 300).catch(() => undefined);
      return tenant.id;
    }
  } catch (err) {
    logger.error('getDefaultTenantId failed', { error: String(err) });
  }
  return null;
}

export async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const headerId = req.headers.get('x-tenant-id');
  if (headerId) return headerId;

  const slug = req.headers.get('x-tenant-slug');
  if (slug) {
    const t = await prisma.tenant.findUnique({ where: { slug } }).catch(() => null);
    if (t) return t.id;
  }

  const host = req.headers.get('host');
  if (host) {
    const domain = await prisma.tenantDomain
      .findUnique({ where: { domain: host } })
      .catch(() => null);
    if (domain) return domain.tenantId;
  }

  return getDefaultTenantId();
}
