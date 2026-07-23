import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import {
  PlatformServiceType,
  ISmsAdapter,
  SmsResult,
  ConnectionTestResult,
  HealthCheckResult,
} from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
import { fetchWithTimeout, basicAuth, describeNetworkError } from '@/lib/plugins/adapters/_http';
import crypto from 'crypto';

export class TwilioSmsAdapter extends BaseAdapter implements ISmsAdapter {
  readonly id = 'twilio';
  readonly name = 'Twilio';
  readonly serviceType: PlatformServiceType = 'SMS';

  protected checkConfigured(): boolean {
    return Boolean(this.config?.accountSid && this.config?.authToken);
  }

  async send(params: { to: string; body: string; from?: string }): Promise<SmsResult> {
    if (!this.isConfigured()) throw new Error('Twilio not configured');
    const sid = String(this.config?.accountSid ?? '');
    const token = String(this.config?.authToken ?? '');
    const from = params.from ?? String(this.config?.fromNumber ?? '');
    try {
      const res = await fetchWithTimeout(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: basicAuth(sid, token),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: params.to, From: from, Body: params.body }).toString(),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok) throw new Error(data?.message || `Twilio error ${res.status}`);
      return { success: true, messageId: data.sid ?? crypto.randomUUID(), provider: 'twilio' };
    } catch (err) {
      logger.error('Twilio send failed', { error: String(err) });
      throw err;
    }
  }

  /** REAL test: authenticate against the Twilio Accounts API. */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const sid = String(credentials?.accountSid ?? this.config?.accountSid ?? '');
    const token = String(credentials?.authToken ?? this.config?.authToken ?? '');
    if (!sid || !token) return { success: false, message: 'Account SID and Auth Token are required.' };
    try {
      const res = await fetchWithTimeout(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`,
        { headers: { Authorization: basicAuth(sid, token) } },
      );
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { friendly_name?: string; status?: string };
        return {
          success: true,
          message: `Authenticated with Twilio account "${data.friendly_name ?? sid}" (status: ${data.status ?? 'active'}).`,
        };
      }
      if (res.status === 401) return { success: false, message: 'Invalid Account SID or Auth Token (401 unauthorized).' };
      if (res.status === 404) return { success: false, message: 'Account SID not found (404). Check the SID.' };
      return { success: false, message: `Twilio returned HTTP ${res.status}.` };
    } catch (err) {
      return { success: false, message: describeNetworkError(err) };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    if (!this.checkConfigured()) {
      return { status: 'degraded', latencyMs: 0, message: 'Twilio not configured.', checkedAt: new Date().toISOString() };
    }
    const t = await this.testConnection({});
    return {
      status: t.success ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - started,
      message: t.message,
      checkedAt: new Date().toISOString(),
    };
  }
}

export class ConsoleSmsAdapter extends FallbackAdapter implements ISmsAdapter {
  readonly id = 'console';
  readonly name = 'Console SMS (fallback)';
  readonly serviceType: PlatformServiceType = 'SMS';

  async send(params: { to: string; body: string; from?: string }): Promise<SmsResult> {
    logger.info('[SMS:console] Would send SMS', { to: params.to, body: params.body?.slice(0, 120) });
    return { success: true, messageId: `console-${crypto.randomUUID()}`, provider: 'console' };
  }
}
