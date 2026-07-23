import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import type { CartSummary } from './cart-service';
import crypto from 'crypto';

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DK-${ts}-${rand}`;
}

export interface PlaceOrderInput {
  tenantId: string;
  cart: CartSummary;
  type: 'DELIVERY' | 'COLLECTION';
  customerId?: string;
  // delivery address
  deliveryFirstName?: string;
  deliveryLastName?: string;
  deliveryLine1?: string;
  deliveryLine2?: string;
  deliveryCity?: string;
  deliveryPostcode?: string;
  deliveryPhone?: string;
  deliveryNotes?: string;
  // guest info
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
}

export async function placeOrder(input: PlaceOrderInput) {
  const orderNumber = generateOrderNumber();

  const deliveryFee = input.type === 'COLLECTION' ? 0 : input.cart.deliveryFee;
  const total = input.cart.subtotal + deliveryFee;

  const order = await prisma.order.create({
    data: {
      tenantId: input.tenantId,
      customerId: input.customerId || null,
      orderNumber,
      type: input.type,
      subtotal: new Decimal(input.cart.subtotal),
      deliveryFee: new Decimal(deliveryFee),
      total: new Decimal(total),
      deliveryFirstName: input.deliveryFirstName,
      deliveryLastName: input.deliveryLastName,
      deliveryLine1: input.deliveryLine1,
      deliveryLine2: input.deliveryLine2,
      deliveryCity: input.deliveryCity,
      deliveryPostcode: input.deliveryPostcode,
      deliveryPhone: input.deliveryPhone,
      deliveryNotes: input.deliveryNotes,
      guestEmail: input.guestEmail,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      items: {
        create: input.cart.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          unitPrice: new Decimal(item.unitPrice),
          totalPrice: new Decimal(item.lineTotal),
          modifiers: (item.modifiers ?? null) as never,
          notes: item.notes,
        })),
      },
    },
    include: { items: true },
  });

  return order;
}

export async function getOrderByNumber(tenantId: string, orderNumber: string) {
  return prisma.order.findUnique({
    where: { tenantId_orderNumber: { tenantId, orderNumber } },
    include: { items: true, payments: true },
  });
}

export async function getOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: true, customer: true },
  });
}

export async function updateOrderStatus(
  orderId: string,
  status: 'CONFIRMED' | 'PREPARING' | 'READY' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED',
  extra?: { cancellationReason?: string }
) {
  const timestampField: Record<string, string> = {
    CONFIRMED: 'confirmedAt',
    PREPARING: 'preparingAt',
    READY: 'readyAt',
    DISPATCHED: 'dispatchedAt',
    DELIVERED: 'deliveredAt',
    CANCELLED: 'cancelledAt',
  };
  const data: Record<string, unknown> = {
    status,
    [timestampField[status]]: new Date(),
  };
  if (extra?.cancellationReason) data.cancellationReason = extra.cancellationReason;
  return prisma.order.update({ where: { id: orderId }, data });
}

export async function listOrders(
  tenantId: string,
  opts?: { status?: string; limit?: number; skip?: number }
) {
  const where: Record<string, unknown> = { tenantId };
  if (opts?.status) where.status = opts.status;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 50,
      skip: opts?.skip ?? 0,
    }),
    prisma.order.count({ where }),
  ]);
  return { orders, total };
}
