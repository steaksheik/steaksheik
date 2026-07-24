
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { decryptCredentials } from '@/lib/security/crypto';
import { auditLog } from '@/lib/audit/service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const STOP_KEYWORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']);

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10);
}

/** Twilio's request-signing algorithm: HMAC-SHA1(url + sorted "key"+"value" pairs, authToken), base64. */
function verifyTwilioSignature(url: string, params: Record<string, string>, authToken: string, signature: string): boolean {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function emptyTwiml(): NextResponse {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * POST /api/v1/webhook/twilio — Twilio "A Message Comes In" webhook.
 *
 * Twilio's own carrier-level Advanced Opt-Out already blocks delivery the
 * moment a customer texts STOP — this endpoint exists to keep OUR OWN
 * records in sync, so the dashboard and any future campaign send correctly
 * reflect who has actually opted out. It is not the primary compliance
 * mechanism, just accurate bookkeeping.
 *
 * Must be configured manually in the Twilio Console, on the SMS number in
 * use, under "A Message Comes In" -> this URL. The exact URL configured
 * there must match what this route sees at runtime (scheme/host), since
 * Twilio signs requests against it.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) params[key] = String(value);

  const svc = await prisma.platformService.findFirst({
    where: { serviceType: 'SMS' as never, isEnabled: true },
  });
  if (!svc) return emptyTwiml();

  const creds = decryptCredentials((svc.credentials ?? {}) as Record<string, unknown>);
  const authToken = String(creds.authToken ?? '');
  const signature = req.headers.get('x-twilio-signature');
  const url = req.nextUrl.href;

  if (!authToken || !signature || !verifyTwilioSignature(url, params, authToken, signature)) {
    logger.warn('[twilio-webhook] Signature verification failed');
    return new NextResponse('Invalid signature', { status: 403 });
  }

  const from = params.From ?? '';
  const body = (params.Body ?? '').trim().toLowerCase();
  if (!from || !STOP_KEYWORDS.has(body)) return emptyTwiml();

  const digits = normalizePhone(from);
  if (!digits) return emptyTwiml();

  const customer = await prisma.customer.findFirst({
    where: { tenantId: svc.tenantId, phone: { contains: digits } },
  });
  if (!customer || !customer.marketingSmsConsent) return emptyTwiml();

  await prisma.customer.update({
    where: { id: customer.id },
    data: { marketingSmsConsent: false, marketingConsentUpdatedAt: new Date() },
  });
  await auditLog({
    tenantId: customer.tenantId,
    userId: null,
    action: 'customer.consent_set',
    resource: 'Customer',
    resourceId: customer.id,
    before: { marketingSmsConsent: true },
    after: { marketingSmsConsent: false },
    metadata: { source: 'sms_stop_reply', keyword: body },
  });

  return emptyTwiml();
}
