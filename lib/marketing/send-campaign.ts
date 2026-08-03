import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9()\s-]{6,20}$/;

export interface ExtraRecipient {
  email?: string;
  phone?: string;
  unsubscribeToken: string;
}

export interface ExtraRecipientResolution {
  ready: ExtraRecipient[];
  suppressed: string[];
  invalid: string[];
}

/**
 * Resolve a pasted/uploaded list of ad-hoc emails or phone numbers for a
 * single campaign send. These people are deliberately NOT saved as visible
 * customers (contactSource 'campaign_oneoff') and are never auto-included in
 * a future campaign's audience — but we still create a minimal, hidden
 * record so a reply of STOP or a click on "unsubscribe" is honoured forever.
 * Anyone who already has an explicit opt-out on file (from any source) is
 * suppressed here rather than re-contacted — an ad-hoc paste can never
 * override a previous unsubscribe.
 */
export async function resolveExtraRecipients(
  tenantId: string,
  channel: 'EMAIL' | 'SMS',
  raw: string[],
): Promise<ExtraRecipientResolution> {
  const invalid: string[] = [];
  const cleaned = new Set<string>();
  for (const entry of raw) {
    const v = entry.trim();
    if (!v) continue;
    if (channel === 'EMAIL') {
      const lower = v.toLowerCase();
      if (!EMAIL_RE.test(lower)) { invalid.push(v); continue; }
      cleaned.add(lower);
    } else {
      if (!PHONE_RE.test(v)) { invalid.push(v); continue; }
      cleaned.add(v);
    }
  }
  if (cleaned.size === 0) return { ready: [], suppressed: [], invalid };

  const list = Array.from(cleaned);
  const existing = await prisma.customer.findMany({
    where: channel === 'EMAIL' ? { tenantId, email: { in: list } } : { tenantId, phone: { in: list } },
    select: { email: true, phone: true, marketingEmailConsent: true, marketingSmsConsent: true, unsubscribeToken: true },
  });
  const existingByKey = new Map(existing.map((c) => [channel === 'EMAIL' ? c.email! : c.phone!, c]));

  const ready: ExtraRecipient[] = [];
  const suppressed: string[] = [];

  for (const key of list) {
    const match = existingByKey.get(key);
    if (match) {
      const consented = channel === 'EMAIL' ? match.marketingEmailConsent : match.marketingSmsConsent;
      if (!consented) { suppressed.push(key); continue; }
      ready.push(channel === 'EMAIL' ? { email: key, unsubscribeToken: match.unsubscribeToken } : { phone: key, unsubscribeToken: match.unsubscribeToken });
      continue;
    }
    const created = await prisma.customer.create({
      data: {
        tenantId,
        email: channel === 'EMAIL' ? key : null,
        phone: channel === 'SMS' ? key : null,
        contactSource: 'campaign_oneoff',
        marketingEmailConsent: channel === 'EMAIL',
        marketingSmsConsent: channel === 'SMS',
        marketingConsentUpdatedAt: new Date(),
      },
      select: { unsubscribeToken: true },
    });
    ready.push(channel === 'EMAIL' ? { email: key, unsubscribeToken: created.unsubscribeToken } : { phone: key, unsubscribeToken: created.unsubscribeToken });
  }

  return { ready, suppressed, invalid };
}

interface ConfiguredAdapter<TSend> {
  isFallback: boolean;
  send: TSend;
}

/**
 * Load and reconfigure the tenant's enabled EMAIL/SMS adapter with its live
 * (decrypted) credentials, mirroring the pattern used for transactional mail
 * in lib/notifications/email-service.ts. Returns null if nothing usable is
 * configured — callers must not fall back to console/no-op sends for
 * marketing messages (that would silently "succeed" without reaching anyone).
 */
async function getConfiguredAdapter<TSend>(
  type: 'EMAIL' | 'SMS',
  tenantId: string,
): Promise<ConfiguredAdapter<TSend> | null> {
  const { prisma } = await import('@/lib/db');
  const svc = await prisma.platformService.findFirst({
    where: { tenantId, serviceType: type as never, isEnabled: true },
  });
  if (!svc) return null;

  const { decryptCredentials } = await import('@/lib/security/crypto');
  const { pluginRegistry } = await import('@/lib/plugins/registry');

  const creds = decryptCredentials((svc.credentials ?? {}) as Record<string, unknown>);
  const config = (svc.config ?? {}) as Record<string, unknown>;
  await pluginRegistry.reconfigure(type, { ...config, ...creds });
  const adapter = pluginRegistry.get(type) as unknown as ConfiguredAdapter<TSend>;
  if (adapter.isFallback) return null;
  return adapter;
}

export interface EmailSendResult {
  audienceSize: number;
  sent: number;
  failed: number;
}

/** Sequential-batched send so one slow/failed recipient can't block the rest indefinitely. */
async function runBatched<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await task(items[idx]).catch(() => undefined);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

export async function sendEmailCampaign(params: {
  tenantId: string;
  recipients: { email: string; firstName: string | null; unsubscribeToken: string }[];
  subject: string;
  bodyHtml: string;
  /** Optional flyer/promo image URL (already uploaded to storage) shown above the message body. */
  flyerUrl?: string;
  siteOrigin: string;
}): Promise<EmailSendResult> {
  const adapter = await getConfiguredAdapter<
    (p: { to: string; subject: string; html: string }) => Promise<{ success: boolean }>
  >('EMAIL', params.tenantId);
  if (!adapter) throw new Error('No email provider is configured and enabled. Set one up under Admin → Platform Services.');

  const { emailWrapper } = await import('@/lib/notifications/email-service');

  const flyerHtml = params.flyerUrl
    ? `<img src="${params.flyerUrl}" alt="" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px;margin:0 0 20px;" />`
    : '';

  let sent = 0;
  let failed = 0;
  await runBatched(params.recipients, 8, async (r) => {
    const unsubscribeUrl = `${params.siteOrigin}/unsubscribe?token=${r.unsubscribeToken}&channel=email`;
    const html = await emailWrapper(`
      ${flyerHtml}
      ${params.bodyHtml}
      <p style="color:#999;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
        You're receiving this because you opted in to marketing emails from The Steak Sheikh.
        <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a>
      </p>
    `);
    try {
      const result = await adapter.send({ to: r.email, subject: params.subject, html });
      if (result.success) sent++;
      else failed++;
    } catch (err) {
      failed++;
      logger.warn('[marketing] email send failed', { to: r.email, error: (err as Error).message });
    }
  });

  return { audienceSize: params.recipients.length, sent, failed };
}

export async function sendSmsCampaign(params: {
  tenantId: string;
  recipients: { phone: string; unsubscribeToken: string }[];
  message: string;
  siteOrigin: string;
}): Promise<EmailSendResult> {
  const adapter = await getConfiguredAdapter<
    (p: { to: string; body: string }) => Promise<{ success: boolean }>
  >('SMS', params.tenantId);
  if (!adapter) throw new Error('No SMS provider is configured and enabled. Set one up under Admin → Platform Services.');

  let sent = 0;
  let failed = 0;
  await runBatched(params.recipients, 5, async (r) => {
    const body = `${params.message}\nReply STOP to opt out.`;
    try {
      const result = await adapter.send({ to: r.phone, body });
      if (result.success) sent++;
      else failed++;
    } catch (err) {
      failed++;
      logger.warn('[marketing] sms send failed', { to: r.phone, error: (err as Error).message });
    }
  });

  return { audienceSize: params.recipients.length, sent, failed };
}
