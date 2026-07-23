import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getModule } from '@/lib/config/service';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'config:settings:read');
  const moduleName = String(params?.module ?? '');
  const values = await getModule(ctx.tenantId, moduleName);
  return ok({ module: moduleName, values });
});
