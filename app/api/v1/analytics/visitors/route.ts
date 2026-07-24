
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { decryptCredentials } from '@/lib/security/crypto';
import { getVisitorAnalytics } from '@/lib/analytics/ga4-reporting';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/analytics/visitors?days=30 — website visitor/traffic report,
 * pulled live from the GA4 Data API. Requires the GA4 service to have both a
 * Property ID and a Service Account JSON key configured (Admin -> Services);
 * the Measurement ID alone (used for tracking) isn't sufficient to read
 * reports back out.
 */
export const GET = withRoute(async (req) => {
  const auth = await requirePermission(req, 'analytics:dashboard:read');
  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '30', 10) || 30, 7), 90);

  const svc = await prisma.platformService.findUnique({
    where: { tenantId_serviceType: { tenantId: auth.tenantId, serviceType: 'ANALYTICS_GA4' as never } },
  });
  if (!svc) return ok({ configured: false });

  const config = (svc.config ?? {}) as Record<string, unknown>;
  const creds = decryptCredentials((svc.credentials ?? {}) as Record<string, unknown>);
  const propertyId = String(config.propertyId ?? '').trim();
  const serviceAccountJson = String(creds.serviceAccountJson ?? '').trim();

  if (!propertyId || !serviceAccountJson) {
    return ok({ configured: false });
  }

  try {
    const data = await getVisitorAnalytics(propertyId, serviceAccountJson, days);
    return ok({ configured: true, ...data });
  } catch (err) {
    logger.error('GA4 visitor report failed', { error: String(err) });
    return ok({ configured: true, error: (err as Error).message });
  }
});
