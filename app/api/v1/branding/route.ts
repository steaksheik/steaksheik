import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission, publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { publishEvent } from '@/lib/events/bus';

export const dynamic = 'force-dynamic';

/** GET /api/v1/branding — get brand for current tenant (public or admin). */
export const GET = withRoute(async (req: NextRequest) => {
  // Try admin auth first, fall back to public tenant
  let tenantId: string;
  try {
    const ctx = await requirePermission(req, 'branding:brand:read');
    tenantId = ctx.tenantId;
  } catch {
    tenantId = await publicTenant(req);
  }

  const brand = await prisma.brand.findUnique({
    where: { tenantId },
    include: { assets: { orderBy: { sortOrder: 'asc' } }, theme: true },
  });

  return ok({ brand });
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tagline: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  faviconUrl: z.string().url().optional().nullable(),
});

/** PUT /api/v1/branding — update brand settings. */
export const PUT = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'branding:brand:write');
  const body = updateSchema.parse(await req.json().catch(() => ({})));

  const before = await prisma.brand.findUnique({ where: { tenantId: ctx.tenantId } });

  const brand = await prisma.brand.upsert({
    where: { tenantId: ctx.tenantId },
    update: { ...body, updatedAt: new Date() },
    create: {
      tenantId: ctx.tenantId,
      name: body.name ?? 'My Brand',
      tagline: body.tagline,
      description: body.description,
      logoUrl: body.logoUrl,
      faviconUrl: body.faviconUrl,
    },
    include: { assets: { orderBy: { sortOrder: 'asc' } }, theme: true },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'branding.brand.updated',
    resource: 'Brand',
    resourceId: brand.id,
    before,
    after: brand,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'branding.brand.updated',
  });

  return ok({ brand });
});
