import crypto from 'crypto';
import { logger } from '@/lib/logger';

/**
 * QStash transport wrapper with graceful fallback.
 *
 * When QSTASH_TOKEN is configured, events are POSTed to QStash for reliable
 * HTTP delivery. Otherwise, the relay records the event as published locally
 * (the CRON relay / direct handler invocation path still functions for dev).
 */

export function isQStashConfigured(): boolean {
  return Boolean(process.env.QSTASH_TOKEN);
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

export interface PublishResult {
  delivered: boolean;
  transport: 'qstash' | 'local';
  messageId?: string;
  error?: string;
}

/** Publish a single event payload to its destination handler. */
export async function publishToQStash(handler: string, payload: unknown): Promise<PublishResult> {
  const destination = `${baseUrl()}/api/v1/events/${handler}`;

  if (!isQStashConfigured()) {
    logger.info('QStash not configured — event marked published locally', { handler });
    return { delivered: true, transport: 'local' };
  }

  try {
    const res = await fetch(`https://qstash.upstash.io/v2/publish/${destination}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload ?? {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { delivered: false, transport: 'qstash', error: `${res.status} ${text}` };
    }
    const data = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { delivered: true, transport: 'qstash', messageId: data?.messageId };
  } catch (err) {
    logger.error('QStash publish failed', { handler, error: String(err) });
    return { delivered: false, transport: 'qstash', error: String(err) };
  }
}

/**
 * Verify a QStash webhook signature. When no signing key is configured we accept
 * the request in dev but log a warning (never in silence).
 */
export function verifyQStashSignature(signature: string | null, body: string): boolean {
  const key = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!key) {
    logger.warn('QStash signing key not configured — skipping signature verification (dev only)');
    return true;
  }
  if (!signature) return false;
  try {
    const expected = crypto.createHmac('sha256', key).update(body).digest('base64');
    // Constant-time compare
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (err) {
    logger.error('QStash signature verification error', { error: String(err) });
    return false;
  }
}
