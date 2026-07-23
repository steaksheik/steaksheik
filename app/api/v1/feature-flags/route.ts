import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { getAllFlags } from '@/lib/feature-flags/service';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'feature_flags:flags:read');
  const flags = await prisma.featureFlag.findMany({
    include: { overrides: { where: { tenantId: ctx.tenantId } } },
    orderBy: { key: 'asc' },
  });
  const resolved = await getAllFlags(ctx.tenantId);
  const data = (flags ?? []).map((f) => ({
    id: f.id,
    key: f.key,
    name: f.name,
    description: f.description,
    module: f.module,
    type: f.type,
    defaultValue: f.defaultValue,
    isActive: f.isActive,
    version: f.version,
    override: f.overrides?.[0]?.value ?? null,
    resolvedValue: resolved?.[f.key] ?? null,
  }));
  return ok({ flags: data });
});

const createSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  module: z.string().min(1),
  type: z.enum(['BOOLEAN', 'PERCENTAGE', 'VARIANT']).default('BOOLEAN'),
  defaultValue: z.unknown(),
});

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'feature_flags:flags:write');
  const body = createSchema.parse(await req.json().catch(() => ({})));
  const flag = await prisma.featureFlag.create({
    data: {
      key: body.key,
      name: body.name,
      description: body.description ?? null,
      module: body.module,
      type: body.type,
      defaultValue: (body.defaultValue ?? false) as never,
    },
  });
  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'feature_flag.created',
    resource: 'FeatureFlag',
    resourceId: flag.key,
    after: { key: flag.key, defaultValue: flag.defaultValue },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return ok({ flag }, { status: 201 });
});
