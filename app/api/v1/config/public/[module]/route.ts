import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { getPublic } from '@/lib/config/service';

export const dynamic = 'force-dynamic';

// Public — no auth. Returns only isPublic config for the resolved tenant.
export const GET = withRoute(async (req: NextRequest, { params }) => {
  const tenantId = await publicTenant(req);
  const moduleName = String(params?.module ?? '');
  const values = await getPublic(tenantId, moduleName);
  return ok({ module: moduleName, values });
}, { rateLimit: 'ipUnauth' });
