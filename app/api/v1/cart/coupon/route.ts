
import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { getCartSummary } from '@/lib/ordering/cart-service';
import { validateDiscountCode } from '@/lib/ordering/discount-service';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const applySchema = z.object({
  cartToken: z.string(),
  code: z.string().min(1).max(50),
  customerId: z.string().optional(),
});

/** POST /api/v1/cart/coupon — apply a coupon code to the cart */
export const POST = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const body = applySchema.parse(await req.json());

  const cart = await prisma.cart.findUnique({ where: { token: body.cartToken } });
  if (!cart || cart.tenantId !== tenantId) return fail('NOT_FOUND', 'Cart not found', { status: 404 });

  const summary = await getCartSummary(tenantId, body.cartToken);
  if (!summary || summary.items.length === 0) {
    return fail('EMPTY_CART', 'Cart is empty', { status: 400 });
  }

  const result = await validateDiscountCode(tenantId, body.code, summary, body.customerId ?? cart.customerId);
  if (!result.ok) {
    return fail('INVALID_CODE', result.error ?? 'Invalid code', { status: 400 });
  }

  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: result.discount!.code } });
  const updated = await getCartSummary(tenantId, body.cartToken);
  return ok(updated);
}, { rateLimit: 'ipUnauth' });

const removeSchema = z.object({
  cartToken: z.string(),
});

/** DELETE /api/v1/cart/coupon — remove the applied coupon code */
export const DELETE = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const body = removeSchema.parse(await req.json());

  const cart = await prisma.cart.findUnique({ where: { token: body.cartToken } });
  if (!cart || cart.tenantId !== tenantId) return fail('NOT_FOUND', 'Cart not found', { status: 404 });

  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  const updated = await getCartSummary(tenantId, body.cartToken);
  return ok(updated);
}, { rateLimit: 'ipUnauth' });
