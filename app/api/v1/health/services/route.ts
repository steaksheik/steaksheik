import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { pluginRegistry } from '@/lib/plugins/registry';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async () => {
  const health = await pluginRegistry.healthCheckAll();
  return ok({ services: health });
});
