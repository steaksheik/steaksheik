import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { awardOrderPoints } from '@/lib/ordering/loyalty-service';
import { sendNewOrderAdminAlert, sendOrderStatusUpdate } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

// Stripe webhooks must receive raw body
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    logger.warn('[stripe-webhook] Missing signature or webhook secret');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    logger.error('[stripe-webhook] Signature verification failed', { error: (err as Error).message });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  logger.info('[stripe-webhook] Received event', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (!orderId) break;

        // Update payment status
        await prisma.payment.updateMany({
          where: { stripeSessionId: session.id },
          data: {
            status: 'SUCCEEDED',
            stripePaymentIntent: (session.payment_intent as string) || null,
            method: 'card',
          },
        });

        // Confirm order
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });

        // Award loyalty points if customer has an account
        const confirmedOrder = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true, tenantId: true, total: true } });
        if (confirmedOrder?.customerId) {
          try {
            await awardOrderPoints(confirmedOrder.customerId, confirmedOrder.tenantId, orderId, Number(confirmedOrder.total));
            logger.info('[stripe-webhook] Loyalty points awarded', { orderId, customerId: confirmedOrder.customerId });
          } catch (lpErr) {
            logger.error('[stripe-webhook] Failed to award loyalty points', { orderId, error: (lpErr as Error).message });
          }
        }

        logger.info('[stripe-webhook] Order confirmed', { orderId });

        // Send notification emails (fire-and-forget)
        try {
          const fullOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true, customer: true },
          });
          if (fullOrder) {
            const customerName = fullOrder.customer
              ? `${fullOrder.customer.firstName ?? ''} ${fullOrder.customer.lastName ?? ''}`.trim()
              : fullOrder.guestName ?? undefined;
            const customerEmail = fullOrder.customer?.email ?? fullOrder.guestEmail ?? undefined;

            // Admin alert
            sendNewOrderAdminAlert({
              orderNumber: fullOrder.orderNumber,
              total: Number(fullOrder.total),
              type: fullOrder.type,
              items: fullOrder.items.map((i) => ({
                productName: i.productName,
                quantity: i.quantity,
                totalPrice: Number(i.totalPrice),
              })),
              customerName,
              customerEmail,
            }).catch(() => {});

            // Customer confirmation
            if (customerEmail) {
              sendOrderStatusUpdate({
                orderNumber: fullOrder.orderNumber,
                status: 'CONFIRMED',
                total: Number(fullOrder.total),
                customerEmail,
                customerName,
              }).catch(() => {});
            }
          }
        } catch (notifErr) {
          logger.error('[stripe-webhook] Notification error', { orderId, error: (notifErr as Error).message });
        }

        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (!orderId) break;

        await prisma.payment.updateMany({
          where: { stripeSessionId: session.id },
          data: { status: 'CANCELLED' },
        });

        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'Payment session expired' },
        });
        break;
      }

      default:
        logger.info('[stripe-webhook] Unhandled event type', { type: event.type });
    }
  } catch (err) {
    logger.error('[stripe-webhook] Handler error', { type: event.type, error: (err as Error).message });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
