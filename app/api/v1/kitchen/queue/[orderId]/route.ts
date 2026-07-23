import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { advanceKitchenStatus } from '@/lib/kitchen/service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['start_preparing', 'mark_ready', 'bump_back']),
});

/** PUT /api/v1/kitchen/queue/:orderId — advance order kitchen status */
export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const auth = await requirePermission(req, 'kitchen:queue:write');
  const orderId = (params as { orderId: string }).orderId;
  const body = actionSchema.parse(await req.json());

  try {
    const updated = await advanceKitchenStatus(orderId, auth.tenantId, body.action);
    return ok({
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
    });
  } catch (err) {
    return fail('INVALID_TRANSITION', (err as Error).message, { status: 400 });
  }
});
