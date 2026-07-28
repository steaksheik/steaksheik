import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { validateDiscountCode } from './discount-service';

const CART_TTL_HOURS = 72;

function expiresAt() {
  return new Date(Date.now() + CART_TTL_HOURS * 60 * 60 * 1000);
}

export async function getOrCreateCart(tenantId: string, token?: string, customerId?: string) {
  if (token) {
    const existing = await prisma.cart.findUnique({
      where: { token },
      include: { items: true },
    });
    if (existing && existing.tenantId === tenantId) {
      // refresh expiry
      await prisma.cart.update({ where: { id: existing.id }, data: { expiresAt: expiresAt() } });
      return existing;
    }
  }
  // create new cart
  return prisma.cart.create({
    data: {
      tenantId,
      customerId: customerId || null,
      expiresAt: expiresAt(),
    },
    include: { items: true },
  });
}

export async function addItem(
  cartId: string,
  productId: string,
  variantId: string | null,
  unitPrice: number,
  quantity: number,
  modifiers?: unknown,
  notes?: string
) {
  // check if same product+variant already in cart
  const existing = await prisma.cartItem.findFirst({
    where: {
      cartId,
      productId,
      variantId: variantId || null,
    },
  });
  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  }
  return prisma.cartItem.create({
    data: {
      cartId,
      productId,
      variantId,
      unitPrice: new Decimal(unitPrice),
      quantity,
      modifiers: (modifiers ?? null) as never,
      notes,
    },
  });
}

export async function updateItemQuantity(itemId: string, quantity: number) {
  if (quantity <= 0) {
    return prisma.cartItem.delete({ where: { id: itemId } });
  }
  return prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
}

export async function removeItem(itemId: string) {
  return prisma.cartItem.delete({ where: { id: itemId } });
}

export async function clearCart(cartId: string) {
  await prisma.cart.update({ where: { id: cartId }, data: { couponCode: null } });
  return prisma.cartItem.deleteMany({ where: { cartId } });
}

export interface CartSummary {
  cartId: string;
  token: string;
  items: {
    id: string;
    productId: string;
    productName: string;
    productSlug: string;
    categoryId: string | null;
    variantId: string | null;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageUrl: string | null;
    modifiers: unknown;
    notes: string | null;
  }[];
  subtotal: number;
  deliveryFee: number;
  couponCode: string | null;
  discountAmount: number;
  couponError: string | null;
  total: number;
  itemCount: number;
}

const DEFAULT_DELIVERY_FEE = 3.99;
const FREE_DELIVERY_THRESHOLD = 30;

export async function getCartSummary(tenantId: string, token: string): Promise<CartSummary | null> {
  const cart = await prisma.cart.findUnique({
    where: { token },
    include: {
      items: true,
    },
  });
  if (!cart || cart.tenantId !== tenantId) return null;

  // enrich items with product info
  const productIds = [...new Set(cart.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { images: { where: { isPrimary: true }, take: 1 }, variants: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const items = cart.items.map((item) => {
    const product = productMap.get(item.productId);
    const variant = item.variantId
      ? product?.variants.find((v) => v.id === item.variantId)
      : null;
    const unitPrice = Number(item.unitPrice);
    return {
      id: item.id,
      productId: item.productId,
      productName: product?.name ?? 'Unknown',
      productSlug: product?.slug ?? '',
      categoryId: product?.categoryId ?? null,
      variantId: item.variantId,
      variantName: variant?.name ?? null,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      imageUrl: product?.images[0]?.url ?? null,
      modifiers: item.modifiers,
      notes: item.notes,
    };
  });

  const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DEFAULT_DELIVERY_FEE;

  let couponCode: string | null = cart.couponCode;
  let discountAmount = 0;
  let couponError: string | null = null;

  if (couponCode) {
    const result = await validateDiscountCode(tenantId, couponCode, { subtotal, items }, cart.customerId);
    if (result.ok) {
      discountAmount = result.amount;
    } else {
      // Code no longer valid (expired, cap reached, cart changed) — drop it
      // silently from the cart so checkout can't apply a stale discount, but
      // surface why so the UI can tell the customer instead of just charging
      // full price with no explanation.
      couponError = result.error ?? 'This code is no longer valid';
      couponCode = null;
      await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    }
  }

  return {
    cartId: cart.id,
    token: cart.token,
    items,
    subtotal,
    deliveryFee,
    couponCode,
    discountAmount,
    couponError,
    total: Math.round((subtotal + deliveryFee - discountAmount) * 100) / 100,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}
