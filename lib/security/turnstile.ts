import { logger } from '@/lib/logger';

/**
 * Cloudflare Turnstile verification for public, unauthenticated forms.
 *
 * Configured with two Vercel environment variables:
 *   NEXT_PUBLIC_TURNSTILE_SITEKEY — public, rendered into the widget
 *   TURNSTILE_SECRET              — server-side only, used here
 *
 * Deliberately FAILS OPEN when TURNSTILE_SECRET is unset: an unconfigured
 * CAPTCHA must never lock real customers out of signing up or logging in.
 * That also keeps Vercel preview deployments working, since previews run on
 * *.vercel.app which can't be added to the widget's hostname list.
 *
 * Once the secret IS set, every failure mode below fails CLOSED.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

/** Whether Turnstile enforcement is switched on for this deployment. */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET);
}

/**
 * Hostnames a token is allowed to have been minted on.
 *
 * TURNSTILE_HOSTNAMES (comma-separated) is the explicit, strict allowlist and
 * takes precedence when set. Without it we fall back to the host the request
 * itself arrived on — i.e. "the token must come from the same site it's being
 * submitted to" — which self-configures across the apex domain, www, and local
 * development without needing a third environment variable per deployment.
 */
function allowedHostnames(requestHost: string | null): Set<string> {
  const configured = (process.env.TURNSTILE_HOSTNAMES ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  if (configured.length > 0) return new Set(configured);

  // Host header can include a port (localhost:3000) — Turnstile reports the
  // bare hostname, so strip it.
  const bare = (requestHost ?? '').split(':')[0].trim();
  return bare ? new Set([bare]) : new Set();
}

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Verify a Turnstile token submitted with a public form.
 *
 * @param token     the widget's token (`turnstileToken` in the request body)
 * @param action    the action this form's widget was rendered with — checked
 *                  so a token minted on the newsletter box can't be replayed
 *                  against the signup endpoint
 * @param remoteIp  the client IP, forwarded to Cloudflare for its own scoring
 * @param host      the request's Host header, used for the hostname check
 */
export async function verifyTurnstile(params: {
  token: unknown;
  action: string;
  remoteIp?: string | null;
  host?: string | null;
}): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return { ok: true }; // not configured — fail open, see above

  const { token, action } = params;
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: 'missing_or_malformed_token' };
  }

  const hostnames = allowedHostnames(params.host ?? null);
  if (hostnames.size === 0) return { ok: false, reason: 'no_expected_hostname' };

  let result: SiteverifyResponse;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: token,
        ...(params.remoteIp ? { remoteip: params.remoteIp } : {}),
      }).toString(),
    });
    if (!res.ok) throw new Error(`siteverify returned ${res.status}`);
    result = (await res.json()) as SiteverifyResponse;
  } catch (err) {
    // Network error, non-2xx, or unparseable body — fail closed.
    logger.error('[turnstile] siteverify call failed', { action, error: (err as Error).message });
    return { ok: false, reason: 'siteverify_unreachable' };
  }

  if (!result.success) {
    logger.warn('[turnstile] token rejected', { action, errorCodes: result['error-codes'] ?? [] });
    return { ok: false, reason: 'token_rejected' };
  }
  if (result.action !== action) {
    logger.warn('[turnstile] action mismatch', { expected: action, got: result.action });
    return { ok: false, reason: 'action_mismatch' };
  }
  if (!result.hostname || !hostnames.has(result.hostname)) {
    logger.warn('[turnstile] hostname not allowed', { action, got: result.hostname });
    return { ok: false, reason: 'hostname_not_allowed' };
  }

  return { ok: true };
}
