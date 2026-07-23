import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import { PlatformServiceType, IAnalyticsAdapter } from '@/lib/plugins/types';
import { logger } from '@/lib/logger';

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
}

export class GtmAdapter extends BaseAnalyticsAdapter {
  readonly id = 'gtm';
  readonly name = 'Google Tag Manager';
  readonly serviceType: PlatformServiceType = 'ANALYTICS_GTM';
  protected checkConfigured(): boolean {
    return Boolean(this.config?.containerId);
  }
}

export class PostHogAdapter extends BaseAnalyticsAdapter {
  readonly id = 'posthog';
  readonly name = 'PostHog';
  readonly serviceType: PlatformServiceType = 'ANALYTICS_PH';
  protected checkConfigured(): boolean {
    return Boolean(this.config?.apiKey);
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
