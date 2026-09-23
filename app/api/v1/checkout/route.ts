import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { getCartSummary } from '@/lib/ordering/cart-service';
import { placeOrder } from '@/lib/ordering/order-service';
import { validateDeliveryPostcode } from '@/lib/ordering/delivery-validation';
import { getStripeClient } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  cartToken: z.string(),
  type: z.enum(['DELIVERY', 'COLLECTION']),
  // delivery address (required for DELIVERY)
  deliveryFirstName: z.string().optional(),
  deliveryLastName: z.string().optional(),
  deliveryLine1: z.string().optional(),
  deliveryLine2: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryPostcode: z.string().optional(),
  deliveryPhone: z.string().optional(),
  deliveryNotes: z.string().optional(),
  // guest or customer
  guestEmail: z.string().email().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  customerId: z.string().optional(),
});

/** POST /api/v1/checkout — create order + Stripe checkout session */
export const POST = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const body = checkoutSchema.parse(await req.json());

  const cart = await getCartSummary(tenantId, body.cartToken);
  if (!cart || cart.items.length === 0) {
    return fail('EMPTY_CART', 'Cart is empty or not found', { status: 400 });
  }

  // Validate delivery fields for DELIVERY orders
  if (body.type === 'DELIVERY') {
    if (!body.deliveryFirstName || !body.deliveryLine1 || !body.deliveryCity || !body.deliveryPostcode) {
      return fail('MISSING_ADDRESS', 'Delivery address is required', { status: 400 });
    }
    const postcodeCheck = await validateDeliveryPostcode(tenantId, body.deliveryPostcode);
    if (!postcodeCheck.ok) {
      return fail('INVALID_ADDRESS', postcodeCheck.error ?? 'Invalid delivery address', { status: 400 });
    }
  }

  // Must have email (guest or customer)
  const email = body.guestEmail || (body.customerId ? (await prisma.customer.findUnique({ where: { id: body.customerId } }))?.email : null);
  if (!email) return fail('MISSING_EMAIL', 'Email is required', { status: 400 });

  // Resolve Stripe before placing the order — failing here (misconfigured
  // Payments in Admin -> Platform Services) must not leave behind an orphaned
  // PENDING order with no way to ever be paid.
  let stripe;
  try {
    stripe = await getStripeClient(tenantId);
  } catch {
    return fail('PAYMENT_NOT_CONFIGURED', 'Online payment is not available right now. Please try again shortly or contact us.', { status: 503 });
  }

  // Place order
  const order = await placeOrder({
    tenantId,
    cart,
    type: body.type,
    customerId: body.customerId,
    deliveryFirstName: body.deliveryFirstName,
    deliveryLastName: body.deliveryLastName,
    deliveryLine1: body.deliveryLine1,
    deliveryLine2: body.deliveryLine2,
    deliveryCity: body.deliveryCity,
    deliveryPostcode: body.deliveryPostcode,
    deliveryPhone: body.deliveryPhone,
    deliveryNotes: body.deliveryNotes,
    guestEmail: body.guestEmail,
    guestName: body.guestName,
    guestPhone: body.guestPhone,
  });

  // Create Stripe Checkout Session
  const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const lineItems = cart.items.map((item) => ({
    price_data: {
      currency: 'gbp',
      product_data: {
        name: item.productName + (item.variantName ? ` (${item.variantName})` : ''),
      },
      unit_amount: Math.round(item.unitPrice * 100),
    },
    quantity: item.quantity,
  }));

  // Add delivery fee as line item if applicable
  const deliveryFee = body.type === 'COLLECTION' ? 0 : cart.deliveryFee;
  if (deliveryFee > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: { name: 'Delivery Fee' },
        unit_amount: Math.round(deliveryFee * 100),
      },
      quantity: 1,
    });
  }

  // Line items keep real product prices (so receipts read correctly) — a
  // one-time Stripe coupon applies the discount to the session total instead.
  const orderDiscount = Number(order.discount);
  let session;
  try {
    let stripeDiscounts: { coupon: string }[] | undefined;
    if (orderDiscount > 0) {
      const stripeCoupon = await stripe.coupons.create({
        amount_off: Math.round(orderDiscount * 100),
        currency: 'gbp',
        duration: 'once',
        name: order.couponCode ?? 'Discount',
      });
      stripeDiscounts = [{ coupon: stripeCoupon.id }];
    }

    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Managed Payments (the default on newer Stripe accounts) both rejects
      // an explicit payment_method_types and requires every line item to
      // carry a Stripe tax code, since it takes over automatic tax
      // calculation too. This app already computes its own final prices,
      // delivery fee and discount server-side — there's no Stripe Tax setup
      // to feed it — so disable Managed Payments for this session and keep
      // the classic, self-computed-price checkout this code was built for.
      managed_payments: { enabled: false },
      customer_email: email,
      line_items: lineItems,
      discounts: stripeDiscounts,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId,
        cartToken: body.cartToken,
      },
      success_url: `${origin}/order-confirmation?orderNumber=${order.orderNumber}`,
      cancel_url: `${origin}/checkout?cancelled=true`,
    });
  } catch (err) {
    // Surface Stripe's own message (safe -- describes API/account
    // configuration issues, never secrets) instead of the generic
    // "unexpected error", so a misconfiguration is diagnosable from the
    // toast alone rather than needing a server log lookup every time.
    logger.error('[checkout] Stripe session creation failed', {
      orderId: order.id,
      error: (err as Error).message,
    });
    return fail('PAYMENT_ERROR', `Payment setup failed: ${(err as Error).message}`, { status: 502 });
  }

  // Record payment
  await prisma.payment.create({
    data: {
      orderId: order.id,
      stripeSessionId: session.id,
      amount: order.total,
      currency: 'GBP',
      status: 'PENDING',
    },
  });

  // The cart is deliberately NOT cleared here — it's only cleared once the
  // Stripe webhook confirms payment actually succeeded (see webhook/stripe/
  // route.ts). Clearing eagerly meant a declined card or an abandoned
  // checkout left the customer with an empty cart to rebuild from scratch.

  return ok({
    sessionUrl: session.url,
    orderNumber: order.orderNumber,
    orderId: order.id,
  });
}, { rateLimit: 'ipUnauth' });
