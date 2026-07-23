import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { getCartSummary, clearCart } from '@/lib/ordering/cart-service';
import { placeOrder } from '@/lib/ordering/order-service';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
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
  }

  // Must have email (guest or customer)
  const email = body.guestEmail || (body.customerId ? (await prisma.customer.findUnique({ where: { id: body.customerId } }))?.email : null);
  if (!email) return fail('MISSING_EMAIL', 'Email is required', { status: 400 });

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

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: lineItems,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId,
    },
    success_url: `${origin}/order-confirmation?orderNumber=${order.orderNumber}`,
    cancel_url: `${origin}/checkout?cancelled=true`,
  });

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

  // Clear cart after checkout
  await clearCart(cart.cartId);

  return ok({
    sessionUrl: session.url,
    orderNumber: order.orderNumber,
    orderId: order.id,
  });
}, { rateLimit: 'ipUnauth' });
