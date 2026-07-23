import { IPluginAdapter, PlatformServiceType, HealthCheckResult } from '@/lib/plugins/types';
import { CircuitBreaker } from '@/lib/plugins/circuit-breaker';
import { logger } from '@/lib/logger';
import { MultiProviderEmailAdapter, ConsoleEmailAdapter } from '@/lib/plugins/adapters/email';
import { TwilioSmsAdapter, ConsoleSmsAdapter } from '@/lib/plugins/adapters/sms';
import { S3StorageAdapter, LocalStorageAdapter } from '@/lib/plugins/adapters/storage';
import { StripePaymentAdapter, NoopPaymentAdapter } from '@/lib/plugins/adapters/payment';
import { CloudFrontCdnAdapter, CloudflareCdnAdapter, NoopCdnAdapter } from '@/lib/plugins/adapters/cdn';
import { GoogleMapsAdapter, NoopMapsAdapter } from '@/lib/plugins/adapters/maps';
import {
  Ga4Adapter,
  GtmAdapter,
  PostHogAdapter,
  ConsoleAnalyticsAdapter,
  NoopAnalyticsAdapter,
} from '@/lib/plugins/adapters/analytics';
import { SentryAdapter, BetterStackAdapter, ConsoleMonitoringAdapter } from '@/lib/plugins/adapters/monitoring';

interface Registration {
  primary: IPluginAdapter;
  fallback: IPluginAdapter;
  breaker: CircuitBreaker;
}

export interface AdapterCatalogEntry {
  serviceType: PlatformServiceType;
  adapterId: string;
  name: string;
  fallbackId: string;
}

class PluginRegistry {
  private registrations = new Map<PlatformServiceType, Registration>();
  private initialized = false;

  /** Register defaults (idempotent). Adapters init with empty config until
   *  runtime credentials are loaded from PlatformService. */
  init(): void {
    if (this.initialized) return;
    this.registerPair('EMAIL', new MultiProviderEmailAdapter(), new ConsoleEmailAdapter());
    this.registerPair('SMS', new TwilioSmsAdapter(), new ConsoleSmsAdapter());
    this.registerPair('STORAGE', new S3StorageAdapter(), new LocalStorageAdapter());
    this.registerPair('PAYMENT', new StripePaymentAdapter(), new NoopPaymentAdapter());
    this.registerPair('CDN', new CloudFrontCdnAdapter(), new NoopCdnAdapter());
    this.registerPair('DNS_CDN', new CloudflareCdnAdapter(), new NoopCdnAdapter());
    this.registerPair('MAPS', new GoogleMapsAdapter(), new NoopMapsAdapter());
    this.registerPair('ANALYTICS_GA4', new Ga4Adapter(), new ConsoleAnalyticsAdapter());
    this.registerPair('ANALYTICS_GTM', new GtmAdapter(), new NoopAnalyticsAdapter());
    this.registerPair('ANALYTICS_PH', new PostHogAdapter(), new ConsoleAnalyticsAdapter());
    this.registerPair('ERROR_TRACKING', new SentryAdapter(), new ConsoleMonitoringAdapter());
    this.registerPair('UPTIME', new BetterStackAdapter(), new ConsoleMonitoringAdapter());
    this.initialized = true;
  }

  private registerPair(type: PlatformServiceType, primary: IPluginAdapter, fallback: IPluginAdapter): void {
    // Initialise with empty config (graceful — falls back until configured)
    primary.initialize({}).catch(() => undefined);
    fallback.initialize({}).catch(() => undefined);
    this.registrations.set(type, {
      primary,
      fallback,
      breaker: new CircuitBreaker(`${type}:${primary.id}`),
    });
  }

  /** Re-initialise a primary adapter with runtime credentials. */
  async reconfigure(type: PlatformServiceType, config: Record<string, unknown>): Promise<void> {
    this.init();
    const reg = this.registrations.get(type);
    if (!reg) return;
    await reg.primary.initialize(config).catch((err) =>
      logger.error('reconfigure failed', { type, error: String(err) })
    );
  }

  /** Get the adapter to use: primary if configured & circuit healthy, else fallback. */
  get<T extends IPluginAdapter>(type: PlatformServiceType): T {
    this.init();
    const reg = this.registrations.get(type);
    if (!reg) throw new Error(`No adapter registered for ${type}`);
    if (reg.primary.isConfigured() && reg.breaker.canAttempt()) {
      return reg.primary as T;
    }
    return reg.fallback as T;
  }

  getBreaker(type: PlatformServiceType): CircuitBreaker | undefined {
    return this.registrations.get(type)?.breaker;
  }

  catalog(): AdapterCatalogEntry[] {
    this.init();
    return Array.from(this.registrations.entries()).map(([serviceType, reg]) => ({
      serviceType,
      adapterId: reg.primary.id,
      name: reg.primary.name,
      fallbackId: reg.fallback.id,
    }));
  }

  async healthCheckAll(): Promise<Record<string, HealthCheckResult & { adapterId: string; usingFallback: boolean }>> {
    this.init();
    const out: Record<string, HealthCheckResult & { adapterId: string; usingFallback: boolean }> = {};
    for (const [type, reg] of Array.from(this.registrations.entries())) {
      try {
        const active = this.get(type);
        const health = await active.healthCheck();
        out[type] = { ...health, adapterId: active.id, usingFallback: active.isFallback };
      } catch (err) {
        out[type] = {
          status: 'unhealthy',
          latencyMs: 0,
          message: String(err),
          checkedAt: new Date().toISOString(),
          adapterId: reg.primary.id,
          usingFallback: true,
        };
      }
    }
    return out;
  }
}

const globalForRegistry = globalThis as unknown as { __pluginRegistry?: PluginRegistry };
export const pluginRegistry: PluginRegistry = globalForRegistry.__pluginRegistry ?? new PluginRegistry();
if (!globalForRegistry.__pluginRegistry) globalForRegistry.__pluginRegistry = pluginRegistry;
pluginRegistry.init();
