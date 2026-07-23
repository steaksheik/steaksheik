// Small shared helpers for adapter connection tests.

/** fetch with a timeout (default 8s). Never throws on timeout abort details. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Basic Auth header value for user:pass. */
export function basicAuth(user: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

/** Turn a thrown error into a friendly, human-readable string. */
export function describeNetworkError(err: unknown): string {
  const e = err as { name?: string; message?: string; cause?: { code?: string } };
  if (e?.name === 'AbortError') return 'Request timed out — the provider did not respond.';
  const code = e?.cause?.code;
  if (code === 'ENOTFOUND') return 'Host not found — check the URL / host value.';
  if (code === 'ECONNREFUSED') return 'Connection refused by the provider host.';
  if (code === 'CERT_HAS_EXPIRED' || code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
    return 'TLS certificate problem contacting the provider.';
  }
  return e?.message || 'Network error contacting the provider.';
}
