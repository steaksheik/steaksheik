import dns from 'dns';
import { promisify } from 'util';
import { logger } from '@/lib/logger';

const resolveMx = promisify(dns.resolveMx);
const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

const LOOKUP_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

/**
 * Real-time, no-click check that a domain can actually receive mail — catches
 * obviously-fake domains (typos, made-up TLDs, "any.com") at submit time
 * without requiring a confirmation email. Only returns false on a definitive
 * "this domain can't receive mail" signal (no MX and no A/AAAA record);
 * transient resolver errors or a slow DNS server fail OPEN (return true) so
 * a flaky lookup never blocks a real signup.
 */
export async function domainCanReceiveMail(domain: string): Promise<boolean> {
  const check = async (): Promise<boolean> => {
    let hasNoMx = false;
    try {
      const mx = await resolveMx(domain);
      if (mx?.length) return true;
      hasNoMx = true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOTFOUND' || code === 'ENODATA') {
        hasNoMx = true;
      } else {
        logger.warn('[email-domain] MX lookup error, failing open', { domain, error: String(err) });
        return true;
      }
    }
    if (!hasNoMx) return true;

    // No MX record — RFC 5321 implicit-MX fallback: mail can still be
    // delivered via the domain's own A/AAAA record if one exists.
    try {
      const a = await resolve4(domain);
      if (a?.length) return true;
    } catch { /* fall through */ }
    try {
      const aaaa = await resolve6(domain);
      if (aaaa?.length) return true;
    } catch { /* fall through */ }
    return false;
  };

  return withTimeout(check(), LOOKUP_TIMEOUT_MS, true);
}
