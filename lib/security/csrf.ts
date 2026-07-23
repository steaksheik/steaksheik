import { NextRequest } from 'next/server';
import { randomToken } from '@/lib/security/crypto';
import { CSRF_COOKIE } from '@/lib/constants';

/**
 * Double-submit cookie CSRF protection.
 * A CSRF token is issued as a (readable) cookie at login; state-changing
 * requests must echo it back in the X-CSRF-Token header.
 */

export function generateCsrfToken(): string {
  return randomToken();
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function verifyCsrf(req: NextRequest): boolean {
  if (!MUTATION_METHODS.has(req.method)) return true;
  const header = req.headers.get('x-csrf-token');
  const cookie = req.cookies.get(CSRF_COOKIE)?.value;
  if (!header || !cookie) return false;
  return header === cookie;
}
