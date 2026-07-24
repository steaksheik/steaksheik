import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import {
  PlatformServiceType,
  IAnalyticsAdapter,
  ConnectionTestResult,
  HealthCheckResult,
} from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
import { fetchWithTimeout, describeNetworkError } from '@/lib/plugins/adapters/_http';

class BaseAnalyticsAdapter extends BaseAdapter implements IAnalyticsAdapter {
  readonly id: string = 'analytics';
  readonly name: string = 'Analytics';
  readonly serviceType: PlatformServiceType = 'ANALYTICS_GA4';
  async trackEvent(event: { name: string; properties?: Record<string, unknown>; userId?: string }): Promise<void> {
    logger.info(`${this.name} trackEvent (stub)`, { name: event.name });
  }
  getClientSnippet(): string {
    return '';
  }
  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    if (!this.checkConfigured()) {
      return { status: 'degraded', latencyMs: 0, message: `${this.name} not configured.`, checkedAt: new Date().toISOString() };
    }
    const t = await this.testConnection({});
    return { status: t.success ? 'healthy' : 'unhealthy', latencyMs: Date.now() - started, message: t.message, checkedAt: new Date().toISOString() };
  }
}

export class Ga4Adapter extends BaseAnalyticsAdapter {
  readonly id = 'ga4';
  readonly name = 'Google Analytics 4';
  readonly serviceType: PlatformServiceType = 'ANALYTICS_GA4';
  protected checkConfigured(): boolean {
    return Boolean(this.config?.measurementId);
  }
  getClientSnippet(): string {
    const id = this.config?.measurementId as string;
    if (!id) return '';
    return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`;
  }
    /** GA4 uses a public client-side Measurement ID (G-XXXX) — there is no server
   *  secret to authenticate. We validate the ID format and confirm the gtag
   *  loader is reachable for it. If a Property ID + Service Account JSON are
   *  also present (needed for the in-dashboard visitor reports, not tracking
   *  itself), that reporting credential is verified too. */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const id = String(credentials?.measurementId ?? this.config?.measurementId ?? '');
    if (!id) return { success: false, message: 'Measurement ID is required.' };
    if (!/^G-[A-Z0-9]{6,}$/i.test(id)) {
      return { success: false, message: 'Measurement ID should look like "G-XXXXXXXXXX".' };
    }
    let trackingResult: ConnectionTestResult;
    try {
      const res = await fetchWithTimeout(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`, { method: 'GET' });
      trackingResult = res.ok
        ? { success: true, message: `Measurement ID "${id}" is valid and the GA4 tag loads.` }
        : { success: false, message: `Google returned HTTP ${res.status} loading the GA4 tag.` };
    } catch (err) {
      trackingResult = { success: false, message: describeNetworkError(err) };
    }

    const propertyId = String(credentials?.propertyId ?? this.config?.propertyId ?? '').trim();
    const serviceAccountJson = String(credentials?.serviceAccountJson ?? this.config?.serviceAccountJson ?? '').trim();
    if (!propertyId || !serviceAccountJson) {
      return {
        ...trackingResult,
        message: `${trackingResult.message} (No Property ID / Service Account JSON set — visitor reports in the dashboard won't be available until those are added.)`,
      };
    }

    const { testGa4Reporting } = await import('@/lib/analytics/ga4-reporting');
    const reportingResult = await testGa4Reporting(propertyId, serviceAccountJson);
    return {
      success: trackingResult.success && reportingResult.success,
      message: `Tracking: ${trackingResult.message} Reporting: ${reportingResult.message}`,
    };
  }
}

export class GtmAdapter extends BaseAnalyticsAdapter {
  readonly id = 'gtm';
  readonly name = 'Google Tag Manager';
  readonly serviceType: PlatformServiceType = 'ANALYTICS_GTM';
  protected checkConfigured(): boolean {
    return Boolean(this.config?.containerId);
  }
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const id = String(credentials?.containerId ?? this.config?.containerId ?? '');
    if (!id) return { success: false, message: 'Container ID is required.' };
    if (!/^GTM-[A-Z0-9]{5,}$/i.test(id)) {
      return { success: false, message: 'Container ID should look like "GTM-XXXXXXX".' };
    }
    try {
      const res = await fetchWithTimeout(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`, { method: 'GET' });
      const body = await res.text().catch(() => '');
      // GTM serves a real container script (larger) for valid IDs; unknown IDs
      // return a tiny/near-empty script.
      if (res.ok && body.length > 200) {
        return { success: true, message: `Container "${id}" is valid and its GTM script loads. (GTM is client-side.)` };
      }
      if (res.ok) {
        return { success: false, message: `Container "${id}" returned an empty script — the container may not exist or be published.` };
      }
      return { success: false, message: `Google returned HTTP ${res.status} loading the container.` };
    } catch (err) {
      return { success: false, message: describeNetworkError(err) };
    }
  }
}

export class PostHogAdapter extends BaseAnalyticsAdapter {
  readonly id = 'posthog';
  readonly name = 'PostHog';
  readonly serviceType: PlatformServiceType = 'ANALYTICS_PH';
  protected checkConfigured(): boolean {
    return Boolean(this.config?.apiKey);
  }
  /** REAL test: hit the PostHog decide/flags endpoint with the project key. */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const key = String(credentials?.apiKey ?? this.config?.apiKey ?? '');
    const host = String(credentials?.host ?? this.config?.host ?? 'https://us.i.posthog.com').replace(/\/$/, '');
    if (!key) return { success: false, message: 'Project API Key is required.' };
    if (!/^phc_/.test(key)) {
      return { success: false, message: 'PostHog project keys usually start with "phc_".' };
    }
    try {
      const res = await fetchWithTimeout(`${host}/decide/?v=3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, distinct_id: 'steak-sheikh-healthcheck' }),
      });
      if (res.ok) {
        return { success: true, message: `PostHog reachable at ${host} and the project key was accepted.` };
      }
      if (res.status === 401) return { success: false, message: 'PostHog rejected the project API key (401).' };
      return { success: false, message: `PostHog at ${host} returned HTTP ${res.status}.` };
    } catch (err) {
      return { success: false, message: `Could not reach PostHog at ${host}: ${describeNetworkError(err)}` };
    }
  }
}

export class ConsoleAnalyticsAdapter extends FallbackAdapter implements IAnalyticsAdapter {
  readonly id = 'console';
  readonly name = 'Console Analytics (fallback)';
  readonly serviceType: PlatformServiceType = 'ANALYTICS_GA4';
  async trackEvent(event: { name: string; properties?: Record<string, unknown>; userId?: string }): Promise<void> {
    logger.info('[ANALYTICS:console] event', { name: event.name });
  }
  getClientSnippet(): string {
    return '';
  }
}

export class NoopAnalyticsAdapter extends FallbackAdapter implements IAnalyticsAdapter {
  readonly id = 'noop';
  readonly name = 'No-op Analytics (fallback)';
  readonly serviceType: PlatformServiceType = 'ANALYTICS_GTM';
  async trackEvent(): Promise<void> {
    /* no-op */
  }
  getClientSnippet(): string {
    return '';
  }
}
