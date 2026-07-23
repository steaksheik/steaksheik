import { prisma } from '@/lib/db';
import { cache } from '@/lib/cache/redis';
import { PERMISSIONS_CACHE_TTL_SECONDS } from '@/lib/constants';
import { logger } from '@/lib/logger';

/**
 * Resolve the flattened permission set for a user (module:resource:action).
 * Wildcards from role definitions are expanded lazily at check-time.
 * Cached in Redis under permissions:{userId}.
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const cacheKey = `permissions:${userId}`;
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached) as string[];
  } catch {
    /* fall through to DB */
  }

  const perms = new Set<string>();
  try {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });

    for (const ur of userRoles ?? []) {
      const role = ur?.role;
      if (!role) continue;
      // super_admin / tenant_admin get a global wildcard
      if (role.name === 'super_admin' || role.name === 'tenant_admin') {
        perms.add('*');
      }
      for (const rp of role.rolePermissions ?? []) {
        const p = rp?.permission;
        if (p) perms.add(`${p.resource}:${p.action}`);
      }
    }
  } catch (err) {
    logger.error('Failed to load user permissions', { userId, error: String(err) });
  }

  const list = Array.from(perms);
  try {
    await cache.set(cacheKey, JSON.stringify(list), PERMISSIONS_CACHE_TTL_SECONDS);
  } catch {
    /* ignore cache errors */
  }
  return list;
}

export async function invalidateUserPermissions(userId: string): Promise<void> {
  try {
    await cache.del(`permissions:${userId}`);
  } catch {
    /* ignore */
  }
}

/**
 * Check whether the granted permission set satisfies a required permission.
 * Supports wildcards: '*', 'module:*:*', 'module:resource:*'.
 * required is always concrete, e.g. 'catalogue:products:read'.
 */
export function hasPermission(granted: string[] | Set<string>, required: string): boolean {
  const set = granted instanceof Set ? granted : new Set(granted ?? []);
  if (set.has('*')) return true;
  if (set.has(required)) return true;

  const parts = required.split(':');
  // required format: module:resource:action  (resource may itself contain no colon here)
  // Our permission keys are stored as 'module:resource:action' where resource already
  // includes the module prefix in the catalog (e.g. 'catalogue:products'). So required
  // like 'catalogue:products:read' -> parts = [catalogue, products, read].
  if (parts.length >= 3) {
    const [mod, resource, action] = [parts[0], parts[1], parts[parts.length - 1]];
    // resource wildcard: module:resource:*
    if (set.has(`${mod}:${resource}:*`)) return true;
    // module action wildcard: module:*:action
    if (set.has(`${mod}:*:${action}`)) return true;
    // module wildcard: module:*:*
    if (set.has(`${mod}:*:*`)) return true;
  }
  return false;
}

export function hasAllPermissions(granted: string[] | Set<string>, required: string[]): boolean {
  return (required ?? []).every((p) => hasPermission(granted, p));
}
