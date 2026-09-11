import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { pluginRegistry } from '@/lib/plugins/registry';
import { metaFor } from '@/lib/plugins/service-fields';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'services:platform:read');
  // Adapters marked `hidden` in service-fields.ts are stub integrations with
  // no real capture/invalidate/injection wired up elsewhere -- kept in the
  // registry so they still work if a row somehow exists, just not surfaced
  // as "not configured" clutter in Platform Services / System Health.
  const catalog = pluginRegistry.catalog().filter((c) => !metaFor(c.serviceType)?.hidden);
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
