import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import {
  PlatformServiceType,
  IMonitoringAdapter,
  ConnectionTestResult,
  HealthCheckResult,
} from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
import { fetchWithTimeout, describeNetworkError } from '@/lib/plugins/adapters/_http';

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

  /** REAL test: parse the DSN and confirm the Sentry ingest host is reachable. */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const dsn = String(credentials?.dsn ?? this.config?.dsn ?? '');
    if (!dsn) return { success: false, message: 'Sentry DSN is required.' };
    let host = '';
    let projectId = '';
    try {
      const u = new URL(dsn);
      host = u.host;
      projectId = u.pathname.replace(/^\//, '');
      if (!u.username || !host || !projectId) {
        return { success: false, message: 'DSN is malformed — expected https://<key>@<host>/<projectId>.' };
      }
    } catch {
      return { success: false, message: 'DSN is not a valid URL.' };
    }
    try {
      // The ingest host answers on / (405/404 is fine — it proves reachability).
      const res = await fetchWithTimeout(`https://${host}/`, { method: 'HEAD' });
      return {
        success: true,
        message: `DSN parsed (project ${projectId}) and Sentry host "${host}" is reachable (HTTP ${res.status}).`,
      };
    } catch (err) {
      return { success: false, message: `Sentry host "${host}" unreachable: ${describeNetworkError(err)}` };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    if (!this.checkConfigured()) {
      return { status: 'degraded', latencyMs: 0, message: 'Sentry not configured.', checkedAt: new Date().toISOString() };
    }
    const t = await this.testConnection({});
    return { status: t.success ? 'healthy' : 'unhealthy', latencyMs: Date.now() - started, message: t.message, checkedAt: new Date().toISOString() };
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

  /** REAL test: send a probe log to Better Stack's ingest with the source token. */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const token = String(credentials?.sourceToken ?? this.config?.sourceToken ?? '');
    const ingest = String(credentials?.ingestHost ?? this.config?.ingestHost ?? 'https://in.logs.betterstack.com').replace(/\/$/, '');
    if (!token) return { success: false, message: 'Source Token is required.' };
    try {
      const res = await fetchWithTimeout(ingest, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dt: new Date().toISOString(), message: 'steak-sheikh connectivity probe' }),
      });
      if (res.status === 202 || res.ok) {
        return { success: true, message: 'Better Stack accepted the probe — source token is valid.' };
      }
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Better Stack rejected the source token (unauthorized).' };
      }
      return { success: false, message: `Better Stack returned HTTP ${res.status}.` };
    } catch (err) {
      return { success: false, message: describeNetworkError(err) };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    if (!this.checkConfigured()) {
      return { status: 'degraded', latencyMs: 0, message: 'Better Stack not configured.', checkedAt: new Date().toISOString() };
    }
    const t = await this.testConnection({});
    return { status: t.success ? 'healthy' : 'unhealthy', latencyMs: Date.now() - started, message: t.message, checkedAt: new Date().toISOString() };
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
