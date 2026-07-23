import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const CUSTOMER_SESSION_COOKIE = 'dk_customer_session';

async function getCustomerFromSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const data = JSON.parse(Buffer.from(raw, 'base64').toString());
    if (data.exp < Date.now()) return null;
    return data as { customerId: string; tenantId: string };
  } catch {
    return null;
  }
}

/** GET /api/v1/customers/orders — list customer's own orders */
export const GET = withRoute(async (req: NextRequest) => {
  const session = await getCustomerFromSession();
  if (!session) return fail('NOT_AUTHENTICATED', 'Please log in', { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));
  const status = url.searchParams.get('status');

  const where: Record<string, unknown> = {
    customerId: session.customerId,
    tenantId: session.tenantId,
  };
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        payments: { select: { status: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return ok({
    orders: orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      type: o.type,
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.deliveryFee),
      discount: Number(o.discount),
      total: Number(o.total),
      currency: o.currency,
      createdAt: o.createdAt,
      estimatedReadyAt: o.estimatedReadyAt,
      deliveredAt: o.deliveredAt,
      items: o.items.map(i => ({
        id: i.id,
        productName: i.productName,
        variantName: i.variantName,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
      })),
      paymentStatus: o.payments[0]?.status || 'UNKNOWN',
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
