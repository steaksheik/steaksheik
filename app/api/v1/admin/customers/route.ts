import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/customers — list all customers for the tenant */
export const GET = withRoute(async (req) => {
  const auth = await requirePermission(req, 'ordering:customers:read');

  const customers = await prisma.customer.findMany({
    where: { tenantId: auth.tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return ok(customers);
});
