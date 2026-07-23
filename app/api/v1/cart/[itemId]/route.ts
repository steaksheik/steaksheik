import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { updateItemQuantity, removeItem, getCartSummary } from '@/lib/ordering/cart-service';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  quantity: z.number().int().min(0),
  token: z.string(),
});

/** PUT /api/v1/cart/[itemId] — update item quantity */
export const PUT = withRoute(async (req: NextRequest, { params }) => {
  const tenantId = await publicTenant(req);
  const itemId = (params as { itemId: string }).itemId;
  const body = updateSchema.parse(await req.json());

  // verify item belongs to correct cart
  const item = await prisma.cartItem.findUnique({ where: { id: itemId }, include: { cart: true } });
  if (!item || item.cart.token !== body.token || item.cart.tenantId !== tenantId) {
    return fail('NOT_FOUND', 'Cart item not found', { status: 404 });
  }

  await updateItemQuantity(itemId, body.quantity);
  const summary = await getCartSummary(tenantId, body.token);
  return ok(summary);
}, { rateLimit: 'ipUnauth' });

/** DELETE /api/v1/cart/[itemId]?token=xxx — remove item */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const tenantId = await publicTenant(req);
  const itemId = (params as { itemId: string }).itemId;
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return fail('MISSING_TOKEN', 'Cart token required', { status: 400 });

  const item = await prisma.cartItem.findUnique({ where: { id: itemId }, include: { cart: true } });
  if (!item || item.cart.token !== token || item.cart.tenantId !== tenantId) {
    return fail('NOT_FOUND', 'Cart item not found', { status: 404 });
  }

  await removeItem(itemId);
  const summary = await getCartSummary(tenantId, token);
  return ok(summary);
}, { rateLimit: 'ipUnauth' });
