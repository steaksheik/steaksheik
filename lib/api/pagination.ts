import { hmac } from '@/lib/security/crypto';
import { ApiError } from '@/lib/api/errors';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function cursorSecret(): string {
  return process.env.CURSOR_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'dev-cursor-secret';
}

export interface CursorData {
  id: string;
  sortValue: unknown;
}

export function encodeCursor(data: CursorData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = hmac(payload, cursorSecret());
  return `${payload}.${signature}`;
}

export function decodeCursor(cursor: string): CursorData {
  const [payload, signature] = (cursor ?? '').split('.');
  if (!payload || !signature || hmac(payload, cursorSecret()) !== signature) {
    throw new ApiError('VALIDATION_ERROR', 'Invalid pagination cursor');
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as CursorData;
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Malformed pagination cursor');
  }
}

export interface ParsedPagination {
  cursor: CursorData | null;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function parsePagination(searchParams: URLSearchParams): ParsedPagination {
  const rawLimit = parseInt(searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const cursorParam = searchParams.get('cursor');
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const sortBy = searchParams.get('sortBy') ?? 'createdAt';
  return {
    cursor: cursorParam ? decodeCursor(cursorParam) : null,
    limit,
    sortBy,
    sortOrder,
  };
}
