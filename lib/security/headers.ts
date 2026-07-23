/** Security headers applied globally via middleware. */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-DNS-Prefetch-Control': 'on',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

/**
 * Content-Security-Policy. Note: we intentionally do NOT set X-Frame-Options
 * to DENY so the app remains previewable inside the platform iframe.
 */
export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.posthog.com https://www.googletagmanager.com https://apps.abacus.ai",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://*.upstash.io https://*.sentry.io https://*.posthog.com https://api.stripe.com",
    "frame-src https://js.stripe.com",
  ].join('; ');
}
