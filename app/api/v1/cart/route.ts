import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant } from '@/lib/auth/context';
import { getOrCreateCart, addItem, getCartSummary } from '@/lib/ordering/cart-service';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/** GET /api/v1/cart?token=xxx — get cart summary */
export const GET = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return fail('MISSING_TOKEN', 'Cart token required', { status: 400 });
  const summary = await getCartSummary(tenantId, token);
  if (!summary) return fail('NOT_FOUND', 'Cart not found', { status: 404 });
  return ok(summary);
}, { rateLimit: 'ipUnauth' });

const addSchema = z.object({
  token: z.string().optional(),
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  modifiers: z.any().optional(),
  notes: z.string().optional(),
});

/** POST /api/v1/cart — add item to cart (creates cart if needed) */
export const POST = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const body = addSchema.parse(await req.json());

  // resolve price from product/variant
  const product = await prisma.product.findFirst({
    where: { id: body.productId, tenantId, status: 'PUBLISHED' },
    include: { variants: true, modifierGroups: { include: { modifiers: true } } },
  });
  if (!product) return fail('NOT_FOUND', 'Product not found', { status: 404 });

  let unitPrice = Number(product.basePrice);
  if (body.variantId) {
    const variant = product.variants.find((v) => v.id === body.variantId);
    if (!variant) return fail('NOT_FOUND', 'Variant not found', { status: 404 });
    unitPrice = Number(variant.price);
  }

  // Resolve the client's selected {groupId: modifierId[]} map against the
  // product's actual modifiers server-side, so the stored cart line carries
  // real names/prices (not just opaque IDs) and the extras' cost is folded
  // into unitPrice rather than silently dropped.
  let enrichedModifiers: Array<{ groupId: string; groupName: string; modifierId: string; name: string; priceAdjustment: number }> | undefined;
  if (body.modifiers && typeof body.modifiers === 'object') {
    const selections = body.modifiers as Record<string, string[]>;
    const resolved: typeof enrichedModifiers = [];
    for (const [groupId, modifierIds] of Object.entries(selections)) {
      const group = product.modifierGroups.find((g) => g.id === groupId);
      if (!group || !Array.isArray(modifierIds)) continue;
      for (const modifierId of modifierIds) {
        const modifier = group.modifiers.find((m) => m.id === modifierId);
        if (!modifier) continue;
        const priceAdjustment = Number(modifier.priceAdjustment);
        unitPrice += priceAdjustment;
        resolved.push({ groupId: group.id, groupName: group.name, modifierId: modifier.id, name: modifier.name, priceAdjustment });
      }
    }
    if (resolved.length > 0) enrichedModifiers = resolved;
  }

  const cart = await getOrCreateCart(tenantId, body.token);
  await addItem(cart.id, body.productId, body.variantId || null, unitPrice, body.quantity, enrichedModifiers, body.notes);
  const summary = await getCartSummary(tenantId, cart.token);
  return ok(summary, { status: 201 });
}, { rateLimit: 'ipUnauth' });
