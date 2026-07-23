import { prisma } from '@/lib/db';
import type { OrderStatus } from '@prisma/client';

/** Kitchen-visible order statuses (active queue) */
const ACTIVE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY'];

/** Default prep time estimates in minutes by product category */
const DEFAULT_PREP_MINUTES = 15;

export interface KitchenOrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  modifiers: unknown;
  notes: string | null;
}

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  createdAt: Date;
  confirmedAt: Date | null;
  preparingAt: Date | null;
  readyAt: Date | null;
  estimatedReadyAt: Date | null;
  deliveryNotes: string | null;
  customerName: string;
  items: KitchenOrderItem[];
  itemCount: number;
  elapsedMinutes: number;
  priority: 'normal' | 'urgent' | 'overdue';
}

/** Get active kitchen queue */
export async function getKitchenQueue(tenantId: string): Promise<KitchenOrder[]> {
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      status: { in: ACTIVE_STATUSES },
    },
    include: {
      items: true,
      customer: { select: { firstName: true, lastName: true } },
    } as const,
    orderBy: [
      { status: 'asc' }, // CONFIRMED first, then PREPARING, then READY
      { createdAt: 'asc' }, // oldest first within same status
    ],
  });

  return orders.map((order: typeof orders[number]) => {
    const now = Date.now();
    const startTime = order.confirmedAt || order.createdAt;
    const elapsedMs = now - startTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    let priority: 'normal' | 'urgent' | 'overdue' = 'normal';
    if (order.estimatedReadyAt && now > order.estimatedReadyAt.getTime()) {
      priority = 'overdue';
    } else if (elapsedMinutes > DEFAULT_PREP_MINUTES) {
      priority = 'urgent';
    }

    const cust = order.customer;
    const customerName = cust
      ? `${cust.firstName || ''} ${cust.lastName || ''}`.trim()
      : order.guestName || order.guestEmail || 'Guest';

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      type: order.type,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      preparingAt: order.preparingAt,
      readyAt: order.readyAt,
      estimatedReadyAt: order.estimatedReadyAt,
      deliveryNotes: order.deliveryNotes,
      customerName,
      items: order.items.map((i: typeof order.items[number]) => ({
        id: i.id,
        productName: i.productName,
        variantName: i.variantName,
        quantity: i.quantity,
        modifiers: i.modifiers,
        notes: i.notes,
      })),
      itemCount: order.items.reduce((sum: number, i: typeof order.items[number]) => sum + i.quantity, 0),
      elapsedMinutes,
      priority,
    };
  });
}

/** Get queue stats */
export async function getKitchenStats(tenantId: string) {
  const [confirmed, preparing, ready, todayCompleted] = await Promise.all([
    prisma.order.count({ where: { tenantId, status: 'CONFIRMED' } }),
    prisma.order.count({ where: { tenantId, status: 'PREPARING' } }),
    prisma.order.count({ where: { tenantId, status: 'READY' } }),
    prisma.order.count({
      where: {
        tenantId,
        status: { in: ['DISPATCHED', 'DELIVERED'] },
        updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  // Average prep time today
  const completedToday = await prisma.order.findMany({
    where: {
      tenantId,
      status: { in: ['READY', 'DISPATCHED', 'DELIVERED'] },
      readyAt: { not: null },
      confirmedAt: { not: null },
      updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
    select: { confirmedAt: true, readyAt: true },
  });

  let avgPrepMinutes: number | null = null;
  if (completedToday.length > 0) {
    const totalMs = completedToday.reduce((sum, o) => {
      if (o.confirmedAt && o.readyAt) {
        return sum + (o.readyAt.getTime() - o.confirmedAt.getTime());
      }
      return sum;
    }, 0);
    avgPrepMinutes = Math.round(totalMs / completedToday.length / 60000);
  }

  return {
    queue: { confirmed, preparing, ready, total: confirmed + preparing + ready },
    today: { completed: todayCompleted, avgPrepMinutes },
  };
}

/** Transition order to next kitchen status */
export async function advanceKitchenStatus(
  orderId: string,
  tenantId: string,
  action: 'start_preparing' | 'mark_ready' | 'bump_back'
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
  });
  if (!order) throw new Error('Order not found');

  const transitions: Record<string, { requiredStatus: string[]; newStatus: string; tsField: string }> = {
    start_preparing: { requiredStatus: ['CONFIRMED'], newStatus: 'PREPARING', tsField: 'preparingAt' },
    mark_ready: { requiredStatus: ['PREPARING'], newStatus: 'READY', tsField: 'readyAt' },
    bump_back: { requiredStatus: ['READY'], newStatus: 'PREPARING', tsField: 'preparingAt' },
  };

  const tx = transitions[action];
  if (!tx) throw new Error(`Invalid action: ${action}`);
  if (!tx.requiredStatus.includes(order.status)) {
    throw new Error(`Cannot ${action} an order in ${order.status} status`);
  }

  const data: Record<string, unknown> = {
    status: tx.newStatus,
    [tx.tsField]: new Date(),
  };

  // Set estimated ready time when starting prep
  if (action === 'start_preparing') {
    data.estimatedReadyAt = new Date(Date.now() + DEFAULT_PREP_MINUTES * 60000);
  }

  return prisma.order.update({ where: { id: orderId }, data });
}
