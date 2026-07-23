import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getOrderById, updateOrderStatus } from '@/lib/ordering/order-service';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendOrderStatusUpdate, sendOrderCancelledEmail } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/orders/[id] — admin get order detail */
export const GET = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'ordering:orders:read');
  const orderId = (params as { id: string }).id;
  const order = await getOrderById(orderId);
  if (!order || order.tenantId !== ctx.tenantId) {
    return fail('NOT_FOUND', 'Order not found', { status: 404 });
  }
  return ok(order);
});

const statusSchema = z.object({
  status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED']),
  cancellationReason: z.string().optional(),
});

/** PUT /api/v1/orders/[id] — admin update order status */
export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'ordering:orders:write');
  const orderId = (params as { id: string }).id;
  const body = statusSchema.parse(await req.json());

  const order = await getOrderById(orderId);
  if (!order || order.tenantId !== ctx.tenantId) {
    return fail('NOT_FOUND', 'Order not found', { status: 404 });
  }

  const updated = await updateOrderStatus(orderId, body.status, {
    cancellationReason: body.cancellationReason,
  });

  // Send notification emails (fire-and-forget)
  try {
    const customerEmail = order.customer?.email ?? order.guestEmail;
    const customerName = order.customer
      ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim()
      : order.guestName ?? undefined;

    if (customerEmail) {
      if (body.status === 'CANCELLED') {
        sendOrderCancelledEmail({
          orderNumber: order.orderNumber,
          total: Number(order.total),
          customerEmail,
          customerName,
          cancellationReason: body.cancellationReason,
        }).catch(() => {});
      } else {
        sendOrderStatusUpdate({
          orderNumber: order.orderNumber,
          status: body.status,
          total: Number(order.total),
          customerEmail,
          customerName,
        }).catch(() => {});
      }
    }
  } catch {}

  return ok(updated);
});
