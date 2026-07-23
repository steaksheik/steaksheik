import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission, publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { Errors } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour (#RRGGBB)');

const themeSchema = z.object({
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
  textColor: hexColor.optional(),
  fontPrimary: z.string().min(1).max(100).optional(),
  fontSecondary: z.string().max(100).optional().nullable(),
  fontHeading: z.string().max(100).optional().nullable(),
  borderRadius: z.string().max(20).optional(),
  customCss: z.string().max(10000).optional().nullable(),
  darkMode: z.record(z.unknown()).optional().nullable(),
});

/** GET /api/v1/branding/theme */
export const GET = withRoute(async (req: NextRequest) => {
  let tenantId: string;
  try {
    const ctx = await requirePermission(req, 'branding:theme:read');
    tenantId = ctx.tenantId;
  } catch {
    tenantId = await publicTenant(req);
  }

  const brand = await prisma.brand.findUnique({ where: { tenantId }, select: { id: true } });
  if (!brand) return ok({ theme: null });

  const theme = await prisma.themeConfig.findUnique({ where: { brandId: brand.id } });
  return ok({ theme });
});

/** PUT /api/v1/branding/theme */
export const PUT = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'branding:theme:write');
  const body = themeSchema.parse(await req.json().catch(() => ({})));

  const brand = await prisma.brand.findUnique({ where: { tenantId: ctx.tenantId } });
  if (!brand) throw Errors.notFound('Brand not found. Create brand first.');

  const before = await prisma.themeConfig.findUnique({ where: { brandId: brand.id } });

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor;
  if (body.secondaryColor !== undefined) updateData.secondaryColor = body.secondaryColor;
  if (body.accentColor !== undefined) updateData.accentColor = body.accentColor;
  if (body.backgroundColor !== undefined) updateData.backgroundColor = body.backgroundColor;
  if (body.textColor !== undefined) updateData.textColor = body.textColor;
  if (body.fontPrimary !== undefined) updateData.fontPrimary = body.fontPrimary;
  if (body.fontSecondary !== undefined) updateData.fontSecondary = body.fontSecondary;
  if (body.fontHeading !== undefined) updateData.fontHeading = body.fontHeading;
  if (body.borderRadius !== undefined) updateData.borderRadius = body.borderRadius;
  if (body.customCss !== undefined) updateData.customCss = body.customCss;
  if (body.darkMode !== undefined) updateData.darkMode = body.darkMode === null ? null as unknown as undefined : body.darkMode;

  const theme = await prisma.themeConfig.upsert({
    where: { brandId: brand.id },
    update: updateData,
    create: {
      brandId: brand.id,
      primaryColor: body.primaryColor ?? '#000000',
      secondaryColor: body.secondaryColor ?? '#ffffff',
      accentColor: body.accentColor ?? '#ff6600',
      backgroundColor: body.backgroundColor ?? '#ffffff',
      textColor: body.textColor ?? '#1a1a1a',
      fontPrimary: body.fontPrimary ?? 'Inter',
      fontSecondary: body.fontSecondary ?? null,
      fontHeading: body.fontHeading ?? null,
      borderRadius: body.borderRadius ?? '0.5rem',
      customCss: body.customCss ?? null,
      darkMode: body.darkMode === null ? undefined : (body.darkMode as unknown as undefined),
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'branding.theme.updated',
    resource: 'ThemeConfig',
    resourceId: theme.id,
    before,
    after: theme,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'branding.theme.updated',
  });

  return ok({ theme });
});
