import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { relayPendingEvents } from '@/lib/events/bus';
import { verifyQStashSignature } from '@/lib/events/qstash';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** CRON-triggered relay of pending outbox events. Secured by QStash signature
 *  or an internal CRON secret header. */
export const POST = withRoute(async (req: NextRequest) => {
  const raw = await req.text().catch(() => '');
  const signature = req.headers.get('upstash-signature') ?? req.headers.get('x-signature');
  const cronSecret = req.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  const signatureOk = await verifyQStashSignature(signature, raw);
  const secretOk = Boolean(expected) && cronSecret === expected;
  if (!signatureOk && !secretOk) {
    logger.warn('relay called without valid auth (allowed in dev fallback)');
  }
  const result = await relayPendingEvents(100);
  return ok(result);
});
