import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission, publicTenant } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { getConfiguredMaps } from '@/lib/plugins/maps';

export const dynamic = 'force-dynamic';

/** GET /api/v1/contact-info — get store contact/address details (public or admin). */
export const GET = withRoute(async (req: NextRequest) => {
  let tenantId: string;
  try {
    const ctx = await requirePermission(req, 'config:settings:read');
    tenantId = ctx.tenantId;
  } catch {
    tenantId = await publicTenant(req);
  }

  const contactInfo = await prisma.contactInfo.findUnique({ where: { tenantId } });
  return ok({ contactInfo });
});

const updateSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  postcode: z.string().max(20).optional().nullable(),
  country: z.string().length(2).optional(),
});

/**
 * PUT /api/v1/contact-info — update the store's address/contact details.
 * Re-geocodes automatically when the address/city/postcode changes, using
 * whatever MAPS adapter is currently configured (falls back to a no-op that
 * leaves lat/lng at 0,0 and flags geocoded:false until a Google Maps API key
 * is added in Admin -> Platform Services).
 */
export const PUT = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'config:settings:write');
  const body = updateSchema.parse(await req.json().catch(() => ({})));

  const before = await prisma.contactInfo.findUnique({ where: { tenantId: ctx.tenantId } });

  const addressChanged =
    body.address !== undefined && (body.address !== before?.address || body.city !== before?.city || body.postcode !== before?.postcode);

  let latitude = before?.latitude ?? null;
  let longitude = before?.longitude ?? null;
  let geocoded = false;

  const fullAddress = [body.address ?? before?.address, body.city ?? before?.city, body.postcode ?? before?.postcode, 'UK']
    .filter(Boolean)
    .join(', ');

  if (addressChanged && fullAddress) {
    const maps = await getConfiguredMaps();
    const result = await maps.geocode(fullAddress);
    if (result.success) {
      latitude = result.lat;
      longitude = result.lng;
      geocoded = true;
    }
  }

  const contactInfo = await prisma.contactInfo.upsert({
    where: { tenantId: ctx.tenantId },
    update: { ...body, latitude, longitude, updatedAt: new Date() },
    create: {
      tenantId: ctx.tenantId,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      postcode: body.postcode ?? null,
      country: body.country ?? 'GB',
      latitude,
      longitude,
    },
  });

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'contact_info.updated',
    resource: 'ContactInfo',
    resourceId: contactInfo.id,
    before,
    after: contactInfo,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ contactInfo, geocoded });
});
