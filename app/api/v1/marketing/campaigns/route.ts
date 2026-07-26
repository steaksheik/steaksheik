
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';
import { sendEmailCampaign, sendSmsCampaign } from '@/lib/marketing/send-campaign';

export const dynamic = 'force-dynamic';

const CAMPAIGN_ACTION = 'marketing.campaign.sent';
const CAMPAIGN_RESOURCE = 'MarketingCampaign';

/** GET /api/v1/marketing/campaigns — send history (backed by the audit log, no new table needed). */
export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'notifications:settings:read');
  const rows = await prisma.auditLog.findMany({
    where: { tenantId: ctx.tenantId, action: CAMPAIGN_ACTION, resource: CAMPAIGN_RESOURCE },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  return ok({
    campaigns: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      sentBy: r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() : null,
      ...(r.after as object),
    })),
  });
});

const sendSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS']),
  subject: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
  test: z.object({ email: z.string().email().optional(), phone: z.string().min(4).optional() }).optional(),
});

function siteOrigin(req: NextRequest): string {
  return req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

/** POST /api/v1/marketing/campaigns — send an email or SMS campaign to consented customers, or a single test message. */
export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'notifications:settings:write');
  const body = sendSchema.parse(await req.json().catch(() => ({})));

  if (body.channel === 'EMAIL' && !body.subject?.trim()) {
    return fail('VALIDATION_ERROR', 'A subject is required for email campaigns', { status: 400 });
  }

  const origin = siteOrigin(req);
  const bodyHtml = body.message
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  // ── Test send: one message, no audience touched, no history entry ──
  if (body.test?.email || body.test?.phone) {
    try {
      if (body.channel === 'EMAIL') {
        if (!body.test.email) return fail('VALIDATION_ERROR', 'Test email address required', { status: 400 });
        await sendEmailCampaign({
          tenantId: ctx.tenantId,
          recipients: [{ email: body.test.email, firstName: null, unsubscribeToken: 'test' }],
          subject: `[TEST] ${body.subject}`,
          bodyHtml,
          siteOrigin: origin,
        });
      } else {
        if (!body.test.phone) return fail('VALIDATION_ERROR', 'Test phone number required', { status: 400 });
        await sendSmsCampaign({
          tenantId: ctx.tenantId,
          recipients: [{ phone: body.test.phone, unsubscribeToken: 'test' }],
          message: `[TEST] ${body.message}`,
          siteOrigin: origin,
        });
      }
      return ok({ test: true, sent: 1 });
    } catch (err) {
      return fail('SEND_FAILED', (err as Error).message, { status: 502 });
    }
  }

  // ── Live send to the consented audience ──
  let result;
  try {
    if (body.channel === 'EMAIL') {
      const recipients = await prisma.customer.findMany({
        where: { tenantId: ctx.tenantId, marketingEmailConsent: true },
        select: { email: true, firstName: true, unsubscribeToken: true },
      });
      if (recipients.length === 0) return fail('NO_AUDIENCE', 'No customers have opted in to marketing emails yet', { status: 400 });
      result = await sendEmailCampaign({ tenantId: ctx.tenantId, recipients, subject: body.subject!.trim(), bodyHtml, siteOrigin: origin });
    } else {
      const recipients = await prisma.customer.findMany({
        where: { tenantId: ctx.tenantId, marketingSmsConsent: true, phone: { not: null } },
        select: { phone: true, unsubscribeToken: true },
      });
      const withPhone = recipients.filter((r): r is { phone: string; unsubscribeToken: string } => Boolean(r.phone));
      if (withPhone.length === 0) return fail('NO_AUDIENCE', 'No customers have opted in to marketing texts yet', { status: 400 });
      result = await sendSmsCampaign({ tenantId: ctx.tenantId, recipients: withPhone, message: body.message, siteOrigin: origin });
    }
  } catch (err) {
    return fail('SEND_FAILED', (err as Error).message, { status: 502 });
  }

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: CAMPAIGN_ACTION,
    resource: CAMPAIGN_RESOURCE,
    after: {
      channel: body.channel,
      subject: body.channel === 'EMAIL' ? body.subject : null,
      preview: body.message.slice(0, 200),
      audienceSize: result.audienceSize,
      sent: result.sent,
      failed: result.failed,
    },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    emitEvent: true,
    eventType: 'marketing.campaign.sent',
  });

  return ok(result);
});
