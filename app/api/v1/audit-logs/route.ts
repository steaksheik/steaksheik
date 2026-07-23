import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { parsePagination, encodeCursor } from '@/lib/api/pagination';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'identity:audit:read');
  const sp = req.nextUrl.searchParams;
  const pg = parsePagination(sp);

  const where: Prisma.AuditLogWhereInput = { tenantId: ctx.tenantId };
  const action = sp.get('action');
  const resource = sp.get('resource');
  const userId = sp.get('userId');
  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (userId) where.userId = userId;
  if (pg.cursor) {
    where.createdAt = pg.sortOrder === 'asc'
      ? { gt: new Date(pg.cursor.sortValue as string) }
      : { lt: new Date(pg.cursor.sortValue as string) };
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: pg.sortOrder },
    take: pg.limit + 1,
  });

  const hasMore = rows.length > pg.limit;
  const page = hasMore ? rows.slice(0, pg.limit) : rows;
  const last = page[page.length - 1];
  const cursor = hasMore && last ? encodeCursor({ id: last.id, sortValue: last.createdAt.toISOString() }) : null;

  return ok(page, { pagination: { cursor, limit: pg.limit, hasMore } });
});
