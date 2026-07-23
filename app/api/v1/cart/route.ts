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
    include: { variants: true },
  });
  if (!product) return fail('NOT_FOUND', 'Product not found', { status: 404 });

  let unitPrice = Number(product.basePrice);
  if (body.variantId) {
    const variant = product.variants.find((v) => v.id === body.variantId);
    if (!variant) return fail('NOT_FOUND', 'Variant not found', { status: 404 });
    unitPrice = Number(variant.price);
  }

  const cart = await getOrCreateCart(tenantId, body.token);
  await addItem(cart.id, body.productId, body.variantId || null, unitPrice, body.quantity, body.modifiers, body.notes);
  const summary = await getCartSummary(tenantId, cart.token);
  return ok(summary, { status: 201 });
}, { rateLimit: 'ipUnauth' });
