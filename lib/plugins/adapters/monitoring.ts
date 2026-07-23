import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import { PlatformServiceType, IMonitoringAdapter } from '@/lib/plugins/types';
import { logger } from '@/lib/logger';

export class SentryAdapter extends BaseAdapter implements IMonitoringAdapter {
  readonly id = 'sentry';
  readonly name = 'Sentry';
  readonly serviceType: PlatformServiceType = 'ERROR_TRACKING';
  protected checkConfigured(): boolean {
    return Boolean(this.config?.dsn);
  }
  captureError(error: Error, context?: Record<string, unknown>): void {
    logger.error('Sentry captureError (stub)', { message: error?.message, context });
  }
  captureMessage(message: string, level: 'info' | 'warning' | 'error'): void {
    logger.info('Sentry captureMessage (stub)', { message, level });
  }
}

export class BetterStackAdapter extends BaseAdapter implements IMonitoringAdapter {
  readonly id = 'betterstack';
  readonly name = 'Better Stack';
  readonly serviceType: PlatformServiceType = 'UPTIME';
  protected checkConfigured(): boolean {
    return Boolean(this.config?.sourceToken);
  }
  captureError(error: Error, context?: Record<string, unknown>): void {
    logger.error('BetterStack captureError (stub)', { message: error?.message, context });
  }
  captureMessage(message: string, level: 'info' | 'warning' | 'error'): void {
    logger.info('BetterStack captureMessage (stub)', { message, level });
  }
}

export class ConsoleMonitoringAdapter extends FallbackAdapter implements IMonitoringAdapter {
  readonly id = 'console';
  readonly name = 'Console Monitoring (fallback)';
  readonly serviceType: PlatformServiceType = 'ERROR_TRACKING';
  captureError(error: Error, context?: Record<string, unknown>): void {
    logger.error('[MONITOR:console] error', { message: error?.message, context });
  }
  captureMessage(message: string, level: 'info' | 'warning' | 'error'): void {
    logger.info('[MONITOR:console] message', { message, level });
  }
}
