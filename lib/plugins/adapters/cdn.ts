import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import {
  PlatformServiceType,
  ICdnAdapter,
  ConnectionTestResult,
  HealthCheckResult,
} from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
import {
  fetchWithTimeout,
  describeNetworkError,
  verboseTestMessage,
  extractError,
  verboseServiceErrors,
} from '@/lib/plugins/adapters/_http';

export class CloudFrontCdnAdapter extends BaseAdapter implements ICdnAdapter {
  readonly id = 'cloudfront';
  readonly name = 'Amazon CloudFront';
  readonly serviceType: PlatformServiceType = 'CDN';

  protected checkConfigured(): boolean {
    return Boolean(this.config?.distributionId && this.config?.domain);
  }

  async invalidate(paths: string[]): Promise<void> {
    logger.info('CloudFront invalidate (stub)', { count: paths?.length ?? 0 });
  }
  getDistributionUrl(key: string): string {
    const domain = (this.config?.domain as string) ?? '';
    return domain ? `https://${domain}/${key}` : `/${key}`;
  }

  /** REAL test: verify the distribution domain is reachable over HTTPS.
   *  (Cache invalidation needs AWS keys, which are not stored here; domain
   *  reachability is the meaningful check for a distribution.) */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const domain = String(credentials?.domain ?? this.config?.domain ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const distId = String(credentials?.distributionId ?? this.config?.distributionId ?? '');
    if (!domain) return { success: false, message: 'Distribution domain is required.' };
    try {
      const res = await fetchWithTimeout(`https://${domain}/`, { method: 'HEAD' }, 8000);
      // Any HTTP response (even 403/404) proves the domain resolves & serves.
      return {
        success: true,
        message: `Distribution domain "${domain}" is reachable (HTTP ${res.status})${distId ? `, distribution ${distId}` : ''}.`,
      };
    } catch (err) {
      const info = extractError(err);
      logger.error('CloudFront connection test failed', {
        domain,
        distributionId: distId,
        errorName: info.name,
        errorMessage: info.message,
        errorCode: info.code,
      });
      return {
        success: false,
        message: verboseTestMessage(`Could not reach "${domain}": ${describeNetworkError(err)}`, err),
        details: verboseServiceErrors() ? (info as unknown as Record<string, unknown>) : undefined,
      };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    if (!this.checkConfigured()) {
      return { status: 'degraded', latencyMs: 0, message: 'CloudFront not configured.', checkedAt: new Date().toISOString() };
    }
    const t = await this.testConnection({});
    return { status: t.success ? 'healthy' : 'unhealthy', latencyMs: Date.now() - started, message: t.message, checkedAt: new Date().toISOString() };
  }
}

export class CloudflareCdnAdapter extends BaseAdapter implements ICdnAdapter {
  readonly id = 'cloudflare';
  readonly name = 'Cloudflare';
  readonly serviceType: PlatformServiceType = 'DNS_CDN';

  protected checkConfigured(): boolean {
    return Boolean(this.config?.apiToken && this.config?.zoneId);
  }

  async invalidate(paths: string[]): Promise<void> {
    logger.info('Cloudflare purge (stub)', { count: paths?.length ?? 0 });
  }
  getDistributionUrl(key: string): string {
    const domain = (this.config?.domain as string) ?? '';
    return domain ? `https://${domain}/${key}` : `/${key}`;
  }

  /** REAL test: fetch the zone via the Cloudflare API with the token. */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const token = String(credentials?.apiToken ?? this.config?.apiToken ?? '');
    const zoneId = String(credentials?.zoneId ?? this.config?.zoneId ?? '');
    if (!token || !zoneId) return { success: false, message: 'API Token and Zone ID are required.' };
    try {
      const res = await fetchWithTimeout(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        result?: { name?: string; status?: string };
        errors?: { message?: string }[];
      };
      if (res.ok && data.success && data.result) {
        return { success: true, message: `Connected to Cloudflare zone "${data.result.name}" (status: ${data.result.status ?? 'active'}).` };
      }
      if (res.status === 403) return { success: false, message: 'Token lacks permission for this zone (403).' };
      if (res.status === 400 || res.status === 404) return { success: false, message: 'Zone ID not found or invalid (check the Zone ID).' };
      const msg = data.errors?.[0]?.message;
      return { success: false, message: msg || `Cloudflare returned HTTP ${res.status}.` };
    } catch (err) {
      return { success: false, message: describeNetworkError(err) };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    if (!this.checkConfigured()) {
      return { status: 'degraded', latencyMs: 0, message: 'Cloudflare not configured.', checkedAt: new Date().toISOString() };
    }
    const t = await this.testConnection({});
    return { status: t.success ? 'healthy' : 'unhealthy', latencyMs: Date.now() - started, message: t.message, checkedAt: new Date().toISOString() };
  }
}

export class NoopCdnAdapter extends FallbackAdapter implements ICdnAdapter {
  readonly id = 'noop';
  readonly name = 'No-op CDN (fallback)';
  readonly serviceType: PlatformServiceType = 'CDN';

  async invalidate(): Promise<void> {
    /* returns direct URLs; nothing to invalidate */
  }
  getDistributionUrl(key: string): string {
    return `/${key}`;
  }
}
