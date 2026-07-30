
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getOrderById } from '@/lib/ordering/order-service';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { auditLog } from '@/lib/audit/service';
import { sendOrderRefundedEmail } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

const refundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
});

/** POST /api/v1/orders/[id]/refund — Admin-only: refund a paid order via Stripe. */
export const POST = withRoute(async (req: NextRequest, { params }) => {
  const ctx = await requirePermission(req, 'ordering:orders:refund');
  const orderId = (params as { id: string }).id;
  const body = refundSchema.parse(await req.json().catch(() => ({})));

  const order = await getOrderById(orderId);
  if (!order || order.tenantId !== ctx.tenantId) {
    return fail('NOT_FOUND', 'Order not found', { status: 404 });
  }
  if (order.status === 'REFUNDED') {
    return fail('ALREADY_REFUNDED', 'This order has already been refunded', { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId, status: 'SUCCEEDED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!payment?.stripePaymentIntent) {
    return fail('NO_PAYMENT', 'No successful payment found for this order', { status: 400 });
  }

  const orderTotal = Number(order.total);
  const refundAmount = body.amount ?? orderTotal;
  if (refundAmount > orderTotal) {
    return fail('AMOUNT_TOO_HIGH', 'Refund amount cannot exceed the order total', { status: 400 });
  }

  let refund;
  try {
    refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntent,
      amount: Math.round(refundAmount * 100),
      reason: 'requested_by_customer',
    });
  } catch (err) {
    return fail('REFUND_FAILED', (err as Error).message, { status: 502 });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'REFUNDED' },
  });
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'REFUNDED' },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'ordering.order.refunded',
    resource: 'Order',
    resourceId: orderId,
    before: { status: order.status },
    after: {
      status: 'REFUNDED',
      amount: refundAmount,
      currency: order.currency,
      stripeRefundId: refund.id,
      reason: body.reason ?? null,
    },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'ordering.order.refunded',
  });

  const customerEmail = order.customer?.email ?? order.guestEmail;
  const customerName = order.customer
    ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim()
    : order.guestName ?? undefined;
  if (customerEmail) {
    sendOrderRefundedEmail({
      orderNumber: order.orderNumber,
      refundAmount,
      orderTotal,
      customerEmail,
      customerName,
    }).catch(() => {});
  }

  return ok({ order: updatedOrder, refund: { id: refund.id, amount: refundAmount } });
});
