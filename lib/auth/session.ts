import { prisma } from '@/lib/db';
import { cache } from '@/lib/cache/redis';
import { randomToken } from '@/lib/security/crypto';
import {
  SESSION_TTL_SECONDS,
  SESSION_CACHE_TTL_SECONDS,
  MAX_SESSIONS_PER_USER,
} from '@/lib/constants';
import { getUserPermissions } from '@/lib/auth/rbac';
import { logger } from '@/lib/logger';

export interface SessionData {
  sessionId: string;
  token: string;
  userId: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: string[];
  expiresAt: string;
}

function cacheKey(token: string): string {
  return `session:${token}`;
}

export async function createSession(params: {
  userId: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<SessionData> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  // Enforce max sessions per user (terminate oldest)
  try {
    const existing = await prisma.session.findMany({
      where: { userId: params.userId },
      orderBy: { lastActiveAt: 'asc' },
    });
    if ((existing?.length ?? 0) >= MAX_SESSIONS_PER_USER) {
      const toRemove = existing.slice(0, existing.length - MAX_SESSIONS_PER_USER + 1);
      for (const s of toRemove) {
        await prisma.session.delete({ where: { id: s.id } }).catch(() => undefined);
        await cache.del(cacheKey(s.token)).catch(() => undefined);
      }
    }
  } catch (err) {
    logger.warn('Session limit enforcement failed', { error: String(err) });
  }

  const record = await prisma.session.create({
    data: {
      token,
      userId: params.userId,
      tenantId: params.tenantId,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      expiresAt,
    },
  });

  const permissions = await getUserPermissions(params.userId);

  const data: SessionData = {
    sessionId: record.id,
    token,
    userId: params.userId,
    tenantId: params.tenantId,
    email: params.email,
    firstName: params.firstName,
    lastName: params.lastName,
    permissions,
    expiresAt: expiresAt.toISOString(),
  };

  await cache.set(cacheKey(token), JSON.stringify(data), SESSION_CACHE_TTL_SECONDS).catch(() => undefined);
  return data;
}

export async function getSession(token: string | undefined | null): Promise<SessionData | null> {
  if (!token) return null;

  // 1. Try cache
  try {
    const cached = await cache.get(cacheKey(token));
    if (cached) {
      const data = JSON.parse(cached) as SessionData;
      if (new Date(data.expiresAt).getTime() > Date.now()) return data;
      await cache.del(cacheKey(token)).catch(() => undefined);
    }
  } catch {
    /* fall through to DB */
  }

  // 2. DB lookup
  try {
    const record = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!record || !record.user) return null;
    if (record.expiresAt.getTime() < Date.now()) {
      await prisma.session.delete({ where: { id: record.id } }).catch(() => undefined);
      return null;
    }

    const permissions = await getUserPermissions(record.userId);
    const data: SessionData = {
      sessionId: record.id,
      token: record.token,
      userId: record.userId,
      tenantId: record.tenantId,
      email: record.user.email,
      firstName: record.user.firstName,
      lastName: record.user.lastName,
      permissions,
      expiresAt: record.expiresAt.toISOString(),
    };

    // Sliding window: refresh lastActiveAt
    await prisma.session
      .update({ where: { id: record.id }, data: { lastActiveAt: new Date() } })
      .catch(() => undefined);
    await cache.set(cacheKey(token), JSON.stringify(data), SESSION_CACHE_TTL_SECONDS).catch(() => undefined);
    return data;
  } catch (err) {
    logger.error('getSession failed', { error: String(err) });
    return null;
  }
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await cache.del(cacheKey(token)).catch(() => undefined);
  await prisma.session.deleteMany({ where: { token } }).catch(() => undefined);
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  try {
    const sessions = await prisma.session.findMany({ where: { userId } });
    for (const s of sessions ?? []) {
      await cache.del(cacheKey(s.token)).catch(() => undefined);
    }
    await prisma.session.deleteMany({ where: { userId } });
  } catch (err) {
    logger.warn('destroyAllUserSessions failed', { userId, error: String(err) });
  }
}
