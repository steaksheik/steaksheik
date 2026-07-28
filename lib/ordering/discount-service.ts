
import { prisma } from '@/lib/db';
import type { CartSummary } from './cart-service';

export interface DiscountValidationResult {
  ok: boolean;
  error?: string;
  discount?: {
    id: string;
    code: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  };
  amount: number;
}

/**
 * Validates a coupon code against the current cart contents and returns the
 * discount amount to apply. Always re-run at cart-summary time and again
 * inside the order-placement transaction — a code can expire, hit its cap,
 * or stop matching the cart between when it's entered and when it's paid.
 */
export async function validateDiscountCode(
  tenantId: string,
  code: string,
  cart: Pick<CartSummary, 'subtotal' | 'items'>,
  customerId?: string | null
): Promise<DiscountValidationResult> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return { ok: false, error: 'Enter a code', amount: 0 };

  const discount = await prisma.discount.findUnique({
    where: { tenantId_code: { tenantId, code: normalizedCode } },
  });
  if (!discount) return { ok: false, error: 'Invalid code', amount: 0 };
  if (!discount.isActive) return { ok: false, error: 'This code is no longer active', amount: 0 };

  const now = new Date();
  if (discount.startsAt && now < discount.startsAt) {
    return { ok: false, error: 'This code is not active yet', amount: 0 };
  }
  if (discount.endsAt && now > discount.endsAt) {
    return { ok: false, error: 'This code has expired', amount: 0 };
  }

  const minSubtotal = discount.minSubtotal ? Number(discount.minSubtotal) : 0;
  if (cart.subtotal < minSubtotal) {
    return { ok: false, error: `Spend at least £${minSubtotal.toFixed(2)} to use this code`, amount: 0 };
  }

  if (discount.productId || discount.categoryId) {
    const matches = cart.items.some(
      (item) =>
        (discount.productId && item.productId === discount.productId) ||
        (discount.categoryId && item.categoryId === discount.categoryId)
    );
    if (!matches) {
      return { ok: false, error: "This code doesn't apply to items in your cart", amount: 0 };
    }
  }

  if (discount.maxRedemptions != null) {
    const totalRedemptions = await prisma.discountRedemption.count({ where: { discountId: discount.id } });
    if (totalRedemptions >= discount.maxRedemptions) {
      return { ok: false, error: 'This code has reached its usage limit', amount: 0 };
    }
  }

  if (discount.maxRedemptionsPerCustomer != null && customerId) {
    const customerRedemptions = await prisma.discountRedemption.count({
      where: { discountId: discount.id, customerId },
    });
    if (customerRedemptions >= discount.maxRedemptionsPerCustomer) {
      return { ok: false, error: "You've already used this code", amount: 0 };
    }
  }

  let amount: number;
  if (discount.type === 'PERCENTAGE') {
    amount = cart.subtotal * (Number(discount.value) / 100);
    if (discount.maxDiscountAmount != null) {
      amount = Math.min(amount, Number(discount.maxDiscountAmount));
    }
  } else {
    amount = Math.min(Number(discount.value), cart.subtotal);
  }
  amount = Math.round(amount * 100) / 100;

  return {
    ok: true,
    amount,
    discount: { id: discount.id, code: discount.code, type: discount.type },
  };
}
