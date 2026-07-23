import { IPluginAdapter, PlatformServiceType, HealthCheckResult, ConnectionTestResult } from '@/lib/plugins/types';

export abstract class BaseAdapter implements IPluginAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly serviceType: PlatformServiceType;
  readonly isFallback: boolean = false;

  protected config: Record<string, unknown> = {};
  protected configured = false;

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.config = config ?? {};
    this.configured = this.checkConfigured();
  }

  protected checkConfigured(): boolean {
    return Object.keys(this.config ?? {}).length > 0;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: this.isConfigured() ? 'healthy' : 'degraded',
      latencyMs: 0,
      message: this.isConfigured()
        ? `${this.name} configured`
        : `${this.name} not configured — using graceful fallback`,
      checkedAt: new Date().toISOString(),
    };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const hasCreds = Object.keys(credentials ?? {}).length > 0;
    return {
      success: hasCreds,
      message: hasCreds
        ? `${this.name}: credentials present (validation stub — live check pending real credentials)`
        : `${this.name}: no credentials provided`,
    };
  }
}

/** Fallback adapters are always "configured" and never fail. */
export abstract class FallbackAdapter extends BaseAdapter {
  readonly isFallback = true;
  protected checkConfigured(): boolean {
    return true;
  }
  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'degraded',
      latencyMs: 0,
      message: `${this.name} (fallback active)`,
      checkedAt: new Date().toISOString(),
    };
  }
}
