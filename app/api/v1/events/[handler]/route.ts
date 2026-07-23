import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { verifyQStashSignature } from '@/lib/events/qstash';
import { alreadyProcessed } from '@/lib/events/bus';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function handlerOf(params?: Record<string, string | string[]>): string {
  const h = params?.handler;
  return Array.isArray(h) ? h[0] : (h ?? 'default');
}

/** Inbound webhook endpoint for delivered domain events (QStash target). */
export const POST = withRoute(async (req, { params }) => {
  const handler = handlerOf(params);
  const raw = await (req as NextRequest).text();
  const signature = (req as NextRequest).headers.get('upstash-signature') ?? (req as NextRequest).headers.get('x-signature');
  const valid = await verifyQStashSignature(signature, raw);
  if (!valid) return fail('UNAUTHORIZED', 'Invalid event signature', { status: 401 });

  let envelope: { id?: string; tenantId?: string; type?: string } = {};
  try { envelope = JSON.parse(raw ?? '{}'); } catch { return fail('VALIDATION_ERROR', 'Malformed event body'); }

  const eventId = envelope.id ?? '';
  const tenantId = envelope.tenantId ?? '';
  if (!eventId || !tenantId) return fail('VALIDATION_ERROR', 'Missing event id/tenant');

  if (await alreadyProcessed(tenantId, eventId, handler)) {
    return ok({ eventId, handler, status: 'duplicate' });
  }

  // Domain-specific handling would dispatch here. Foundation logs receipt.
  logger.info('event received', { handler, eventId, type: envelope.type });
  return ok({ eventId, handler, status: 'processed' });
});
