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

/**
 * True when the app is NOT running in production, so connection tests may
 * return raw provider error names/messages in the API response for debugging.
 * Vercel sets VERCEL_ENV to 'production' | 'preview' | 'development'.
 */
export function isDevMode(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv !== 'production';
  return process.env.NODE_ENV !== 'production';
}

/**
 * Whether to include raw provider error name/message in connection-test API
 * responses. True in development, OR when SERVICE_TEST_VERBOSE_ERRORS is set —
 * the latter lets you flip verbose diagnostics on for a live/production
 * deployment temporarily, then turn it back off.
 */
export function verboseServiceErrors(): boolean {
  const flag = process.env.SERVICE_TEST_VERBOSE_ERRORS;
  if (flag === '1' || flag === 'true') return true;
  return isDevMode();
}

/** Structured view of an AWS SDK v3 error for logging + dev responses. */
export interface AwsErrorInfo {
  name: string;
  message: string;
  code?: string;
  httpStatusCode?: number;
  requestId?: string;
  extendedRequestId?: string;
  cfId?: string;
  region?: string;
}

/**
 * Extract the raw AWS SDK error metadata (name, message, HTTP status, request
 * id) so it can be logged in full and — in development — returned to the caller
 * verbatim instead of a sanitised message.
 */
export function extractAwsError(err: unknown): AwsErrorInfo {
  const e = err as {
    name?: string;
    message?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number; requestId?: string; extendedRequestId?: string; cfId?: string };
    $response?: { statusCode?: number };
    region?: string;
  };
  return {
    name: e?.name ?? 'UnknownError',
    message: e?.message ?? String(err),
    code: e?.Code ?? e?.code,
    httpStatusCode: e?.$metadata?.httpStatusCode ?? e?.$response?.statusCode,
    requestId: e?.$metadata?.requestId,
    extendedRequestId: e?.$metadata?.extendedRequestId,
    cfId: e?.$metadata?.cfId,
    region: e?.region,
  };
}

/**
 * Build a connection-test message from an AWS error. In development the raw AWS
 * error name + message (+ status/request id) are appended so the exact cause is
 * visible from the admin UI. In production only the friendly hint is shown.
 */
export function awsTestMessage(friendly: string, info: AwsErrorInfo): string {
  if (!verboseServiceErrors()) return friendly;
  const parts = [`${info.name}: ${info.message}`];
  if (info.httpStatusCode) parts.push(`HTTP ${info.httpStatusCode}`);
  if (info.requestId) parts.push(`requestId ${info.requestId}`);
  return `${friendly} — [AWS] ${parts.join(' · ')}`;
}

/** Structured view of a generic/network error for logging + dev responses. */
export function extractError(err: unknown): { name: string; message: string; code?: string } {
  const e = err as { name?: string; message?: string; code?: string; cause?: { code?: string } };
  return {
    name: e?.name ?? 'Error',
    message: e?.message ?? String(err),
    code: e?.code ?? e?.cause?.code,
  };
}

/** Append the raw error name/message to a friendly message when verbose. */
export function verboseTestMessage(friendly: string, err: unknown): string {
  if (!verboseServiceErrors()) return friendly;
  const info = extractError(err);
  const extra = info.code ? `${info.name}: ${info.message} (${info.code})` : `${info.name}: ${info.message}`;
  return `${friendly} — [raw] ${extra}`;
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
