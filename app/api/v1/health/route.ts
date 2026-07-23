import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { isRedisConfigured } from '@/lib/cache/redis';
import { isQStashConfigured } from '@/lib/events/qstash';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async () => {
  let dbOk = false;
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return ok({
    status: dbOk ? 'ok' : 'degraded',
    checks: {
      database: { status: dbOk ? 'up' : 'down', latencyMs: Date.now() - start },
      cache: { status: 'up', backend: isRedisConfigured() ? 'redis' : 'in-memory' },
      eventBus: { status: 'up', transport: isQStashConfigured() ? 'qstash' : 'local' },
    },
  });
});
