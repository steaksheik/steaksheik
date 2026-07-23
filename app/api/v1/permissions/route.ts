import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest) => {
  await requirePermission(req, 'identity:roles:read');
  const permissions = await prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  const grouped: Record<string, { id: string; key: string; resource: string; action: string; description: string | null }[]> = {};
  for (const p of permissions ?? []) {
    const mod = (p.resource ?? 'general').split(':')[0] ?? 'general';
    if (!grouped[mod]) grouped[mod] = [];
    grouped[mod].push({ id: p.id, key: `${p.resource}:${p.action}`, resource: p.resource, action: p.action, description: p.description });
  }
  const data = (permissions ?? []).map((p) => ({ id: p.id, key: `${p.resource}:${p.action}`, resource: p.resource, action: p.action, description: p.description }));
  return ok({ permissions: data, grouped });
});
