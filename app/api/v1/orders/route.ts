import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant, requirePermission } from '@/lib/auth/context';
import { getOrderByNumber, listOrders } from '@/lib/ordering/order-service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/orders?orderNumber=xxx (public, by order number) */
/** GET /api/v1/orders?status=xxx (admin, list) */
export const GET = withRoute(async (req: NextRequest) => {
  const orderNumber = req.nextUrl.searchParams.get('orderNumber');

  // Public lookup by order number
  if (orderNumber) {
    const tenantId = await publicTenant(req);
    const order = await getOrderByNumber(tenantId, orderNumber);
    if (!order) return fail('NOT_FOUND', 'Order not found', { status: 404 });
    return ok(order);
  }

  // Admin list
  const ctx = await requirePermission(req, 'ordering:orders:read');
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
  const skip = parseInt(req.nextUrl.searchParams.get('skip') || '0', 10);
  const result = await listOrders(ctx.tenantId, { status, limit, skip });
  return ok(result);
});
