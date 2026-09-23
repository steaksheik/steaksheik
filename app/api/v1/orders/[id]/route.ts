import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getOrderById, updateOrderStatus } from '@/lib/ordering/order-service';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { auditLog } from '@/lib/audit/service';
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

  // Cancelling a paid order must actually refund it -- the cancellation
  // email already promises the customer "a refund will be processed", so
  // that can't be left as a second, easy-to-forget manual step. Refund
  // failures don't block the cancellation itself (a kitchen still needs to
  // be able to cancel an order even if Stripe has a transient issue) -- they
  // surface as a warning instead, and the existing Refund button stays
  // available (payment status stays SUCCEEDED) so it can be retried.
  let refundedAmount: number | null = null;
  let refundWarning: string | null = null;
  if (body.status === 'CANCELLED') {
    const unrefunded = order.payments.filter((p) => p.status === 'SUCCEEDED');
    for (const payment of unrefunded) {
      if (!payment.stripePaymentIntent) {
        refundWarning = 'No payment intent on file to refund automatically — use the Refund button if a refund is owed.';
        continue;
      }
      try {
        const stripe = await getStripeClient(ctx.tenantId);
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntent,
          amount: Math.round(Number(payment.amount) * 100),
          reason: 'requested_by_customer',
        });
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
        refundedAmount = (refundedAmount ?? 0) + Number(payment.amount);
        await auditLog({
          tenantId: ctx.tenantId,
          userId: ctx.session.userId,
          action: 'ordering.order.refunded',
          resource: 'Order',
          resourceId: orderId,
          before: { status: order.status },
          after: { status: 'CANCELLED', stripeRefundId: refund.id, amount: Number(payment.amount) },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          emitEvent: true,
          eventType: 'ordering.order.refunded',
        });
      } catch (err) {
        logger.error('[orders] Auto-refund on cancel failed', {
          orderId,
          paymentId: payment.id,
          error: (err as Error).message,
        });
        refundWarning = `Automatic refund failed (${(err as Error).message}) — use the Refund button to retry.`;
      }
    }
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

  return ok({ ...updated, refundedAmount, refundWarning });
});
