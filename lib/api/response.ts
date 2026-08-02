import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

export interface PaginationMeta {
  cursor: string | null;
  limit: number;
  hasMore: boolean;
  total?: number;
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
  timestamp: string;
  requestId: string;
}

/** Recursively convert BigInt & Decimal-like values so JSON.stringify is safe. */
function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  // instanceof, not constructor.name — a string-name check silently breaks
  // under production minification (constructor names get mangled), which
  // let raw Decimal internals leak into API responses and render as "NaN"
  // on the client instead of a number.
  if (value instanceof Decimal) return value.toNumber();
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitize(v);
    }
    return out;
  }
  return value;
}

export function requestId(): string {
  return crypto.randomUUID();
}

export function ok<T>(
  data: T,
  opts?: { pagination?: PaginationMeta; status?: number; requestId?: string }
): NextResponse {
  const body = {
    success: true as const,
    data: sanitize(data),
    meta: {
      ...(opts?.pagination ? { pagination: opts.pagination } : {}),
      timestamp: new Date().toISOString(),
      requestId: opts?.requestId ?? requestId(),
    } as ResponseMeta,
  };
  return NextResponse.json(body, { status: opts?.status ?? 200 });
}

export function fail(
  code: string,
  message: string,
  opts?: { status?: number; details?: unknown[]; requestId?: string }
): NextResponse {
  const rid = opts?.requestId ?? requestId();
  const body = {
    success: false as const,
    error: {
      code,
      message,
      ...(opts?.details ? { details: opts.details } : {}),
      requestId: rid,
    },
  };
  return NextResponse.json(body, { status: opts?.status ?? 400 });
}

/** Convert any thrown error into a safe API error response (no internal leakage). */
export function handleError(err: unknown, rid?: string): NextResponse {
  const requestIdValue = rid ?? requestId();

  if (err instanceof ApiError) {
    return fail(err.code, err.message, {
      status: err.status,
      details: err.details,
      requestId: requestIdValue,
    });
  }

  if (err instanceof ZodError) {
    const details = err.errors?.map((e) => ({
      path: e.path?.join('.') ?? '',
      message: e.message,
    }));
    return fail('VALIDATION_ERROR', 'Request validation failed', {
      status: 400,
      details,
      requestId: requestIdValue,
    });
  }

  // Prisma known error codes
  const prismaCode = (err as { code?: string })?.code;
  if (prismaCode === 'P2002') {
    return fail('CONFLICT', 'A resource with these values already exists', {
      status: 409,
      requestId: requestIdValue,
    });
  }
  if (prismaCode === 'P2025') {
    return fail('NOT_FOUND', 'Resource not found', { status: 404, requestId: requestIdValue });
  }

  logger.error('Unhandled API error', {
    requestId: requestIdValue,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return fail('INTERNAL_ERROR', 'An unexpected error occurred', {
    status: 500,
    requestId: requestIdValue,
  });
}
