import { NextRequest, NextResponse } from 'next/server';
import { SECURITY_HEADERS, contentSecurityPolicy } from '@/lib/security/headers';

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  res.headers.set('Content-Security-Policy', contentSecurityPolicy());
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|og-image.png).*)'],
};
