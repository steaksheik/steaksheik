import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { publishToQStash } from '@/lib/events/qstash';

/**
 * Event Bus — Transactional Outbox pattern.
 *
 * publishEvent() writes an EventOutbox record (PENDING). The relay
 * (relayPendingEvents) picks up pending events and delivers them via QStash,
 * marking them PUBLISHED / FAILED / DEAD_LETTER. The relay can be triggered by
 * a CRON webhook or invoked inline after a write.
 */

export interface DomainEventInput {
  tenantId: string;
  type: string; // {context}.{aggregate}.{action}
  aggregateId: string;
  aggregateType: string;
  payload: unknown;
  userId?: string;
  correlationId?: string;
  causationId?: string;
  scheduledFor?: Date;
}

export interface DomainEvent {
  id: string;
  type: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  payload: unknown;
  metadata: {
    userId: string;
    correlationId: string;
    causationId?: string;
    timestamp: string;
    version: number;
  };
  occurredAt: string;
}

/** Write an event to the outbox (does NOT deliver immediately). */
export async function publishEvent(input: DomainEventInput): Promise<string | null> {
  try {
    const metadata = {
      userId: input.userId ?? 'system',
      correlationId: input.correlationId ?? crypto.randomUUID(),
      causationId: input.causationId,
      timestamp: new Date().toISOString(),
      version: 1,
    };
    const record = await prisma.eventOutbox.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        aggregateId: input.aggregateId,
        aggregateType: input.aggregateType,
        payload: (input.payload ?? {}) as never,
        metadata: metadata as never,
        scheduledFor: input.scheduledFor ?? null,
        status: 'PENDING',
      },
    });
    // Best-effort inline relay (fire and forget). Backup CRON catches failures.
    relayEvent(record.id).catch(() => undefined);
    return record.id;
  } catch (err) {
    logger.error('publishEvent failed', { type: input.type, error: String(err) });
    return null;
  }
}

/** Map event type to its webhook handler name (the {context}). */
export function handlerForType(type: string): string {
  return (type ?? '').split('.')[0] || 'default';
}

/** Deliver a single outbox event. */
export async function relayEvent(eventId: string): Promise<void> {
  const event = await prisma.eventOutbox.findUnique({ where: { id: eventId } }).catch(() => null);
  if (!event || event.status === 'PUBLISHED' || event.status === 'DEAD_LETTER') return;
  if (event.scheduledFor && event.scheduledFor.getTime() > Date.now()) return;

  await prisma.eventOutbox
    .update({ where: { id: eventId }, data: { status: 'PUBLISHING' } })
    .catch(() => undefined);

  const envelope: DomainEvent = {
    id: event.id,
    type: event.type,
    tenantId: event.tenantId,
    aggregateId: event.aggregateId,
    aggregateType: event.aggregateType,
    payload: event.payload,
    metadata: event.metadata as DomainEvent['metadata'],
    occurredAt: event.occurredAt.toISOString(),
  };

  const result = await publishToQStash(handlerForType(event.type), envelope);

  if (result.delivered) {
    await prisma.eventOutbox
      .update({
        where: { id: eventId },
        data: { status: 'PUBLISHED', publishedAt: new Date(), lastError: null },
      })
      .catch(() => undefined);
  } else {
    const retryCount = event.retryCount + 1;
    const deadLettered = retryCount >= event.maxRetries;
    await prisma.eventOutbox
      .update({
        where: { id: eventId },
        data: {
          status: deadLettered ? 'DEAD_LETTER' : 'FAILED',
          retryCount,
          lastError: result.error ?? 'delivery failed',
        },
      })
      .catch(() => undefined);
  }
}

/** Relay all pending / retriable events (invoked by CRON webhook). */
export async function relayPendingEvents(limit = 50): Promise<{ processed: number }> {
  const now = new Date();
  const pending = await prisma.eventOutbox
    .findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
      orderBy: { occurredAt: 'asc' },
      take: limit,
    })
    .catch(() => []);

  for (const e of pending ?? []) {
    await relayEvent(e.id);
  }
  return { processed: pending?.length ?? 0 };
}

/** Idempotency guard for event handlers. Returns true if already processed. */
export async function alreadyProcessed(
  tenantId: string,
  eventId: string,
  handlerName: string
): Promise<boolean> {
  const existing = await prisma.processedEvent
    .findUnique({ where: { eventId_handlerName: { eventId, handlerName } } })
    .catch(() => null);
  if (existing) return true;
  try {
    await prisma.processedEvent.create({ data: { tenantId, eventId, handlerName } });
    return false;
  } catch {
    // Unique violation — processed concurrently
    return true;
  }
}
