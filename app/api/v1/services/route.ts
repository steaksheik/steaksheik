import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { pluginRegistry } from '@/lib/plugins/registry';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'services:platform:read');
  const catalog = pluginRegistry.catalog();
  const configured = await prisma.platformService.findMany({ where: { tenantId: ctx.tenantId } });
  const byType = new Map(configured.map((s) => [s.serviceType, s]));
  const services = catalog.map((c) => {
    const svc = byType.get(c.serviceType as never);
    return {
      serviceType: c.serviceType,
      adapterId: c.adapterId,
      adapterName: c.name,
      fallbackId: c.fallbackId,
      isEnabled: svc?.isEnabled ?? false,
      status: svc?.status ?? 'UNCONFIGURED',
      displayName: svc?.displayName ?? c.name,
      lastHealthCheck: svc?.lastHealthCheck ?? null,
      lastHealthStatus: svc?.lastHealthStatus ?? null,
      configured: Boolean(svc),
    };
  });
  return ok({ services });
});
