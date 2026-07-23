import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { publishEvent } from '@/lib/events/bus';

export interface AuditEntryInput {
  tenantId: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** When true, also emit a domain event via the outbox. */
  emitEvent?: boolean;
  eventType?: string;
}

/**
 * Append-only audit logging. Never throws — audit failures must not break the
 * primary operation.
 */
export async function auditLog(entry: AuditEntryInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        before: (entry.before ?? null) as never,
        after: (entry.after ?? null) as never,
        metadata: (entry.metadata ?? {}) as never,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error('auditLog write failed', { action: entry.action, error: String(err) });
  }

  if (entry.emitEvent && entry.eventType) {
    await publishEvent({
      tenantId: entry.tenantId,
      type: entry.eventType,
      aggregateId: entry.resourceId ?? entry.resource,
      aggregateType: entry.resource,
      payload: { before: entry.before ?? null, after: entry.after ?? null },
      userId: entry.userId ?? 'system',
    }).catch(() => undefined);
  }
}
