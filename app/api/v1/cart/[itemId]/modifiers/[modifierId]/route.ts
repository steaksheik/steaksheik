import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { removeModifierFromItem, getCartSummary } from '@/lib/ordering/cart-service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** DELETE /api/v1/cart/[itemId]/modifiers/[modifierId]?token=xxx — remove a single extra from a cart line. */
export const DELETE = withRoute(async (req: NextRequest, { params }) => {
  const tenantId = await publicTenant(req);
  const { itemId, modifierId } = params as { itemId: string; modifierId: string };
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return fail('MISSING_TOKEN', 'Cart token required', { status: 400 });

  const item = await prisma.cartItem.findUnique({ where: { id: itemId }, include: { cart: true } });
  if (!item || item.cart.token !== token || item.cart.tenantId !== tenantId) {
    return fail('NOT_FOUND', 'Cart item not found', { status: 404 });
  }

  await removeModifierFromItem(itemId, modifierId);
  const summary = await getCartSummary(tenantId, token);
  return ok(summary);
}, { rateLimit: 'ipUnauth' });
