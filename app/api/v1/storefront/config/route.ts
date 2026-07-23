import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { ConfigService } from '@/lib/config/service';
import { getAllFlags } from '@/lib/feature-flags/service';

export const dynamic = 'force-dynamic';

/** Public storefront bootstrap: brand, theme, public config & feature flags. */
export const GET = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const PUBLIC_MODULES = ['platform', 'catalogue', 'seo', 'branding'];
  const [brand, publicModules, flags, tenant] = await Promise.all([
    prisma.brand.findFirst({ where: { tenantId }, include: { assets: true, theme: true } }).catch(() => null),
    Promise.all(PUBLIC_MODULES.map(async (m) => [m, await ConfigService.getPublic(tenantId, m).catch(() => ({}))] as const)),
    getAllFlags(tenantId).catch(() => ({})),
    prisma.tenant.findUnique({ where: { id: tenantId }, include: { socialLinks: true, contactInfo: true } }).catch(() => null),
  ]);
  const config = Object.fromEntries(publicModules ?? []);
  return ok({ tenant, brand, theme: brand?.theme ?? null, config, featureFlags: flags });
}, { rateLimit: 'ipUnauth' });
