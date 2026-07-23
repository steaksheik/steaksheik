import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import {
  PlatformServiceType,
  IPaymentAdapter,
  PaymentIntentResult,
  ConnectionTestResult,
  HealthCheckResult,
} from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
import { fetchWithTimeout, describeNetworkError } from '@/lib/plugins/adapters/_http';
import crypto from 'crypto';

export class StripePaymentAdapter extends BaseAdapter implements IPaymentAdapter {
  readonly id = 'stripe';
  readonly name = 'Stripe';
  readonly serviceType: PlatformServiceType = 'PAYMENT';

  protected checkConfigured(): boolean {
    return Boolean(this.config?.secretKey);
  }

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntentResult> {
    if (!this.isConfigured()) throw new Error('Stripe not configured');
    logger.info('Stripe createPaymentIntent (stub)', { amount: params.amount, currency: params.currency });
    const id = `pi_${crypto.randomUUID()}`;
    return { success: true, intentId: id, clientSecret: `${id}_secret`, provider: 'stripe' };
  }

  /** REAL test: call Stripe's Balance endpoint with the secret key. */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const key = String(credentials?.secretKey ?? this.config?.secretKey ?? '');
    if (!key) return { success: false, message: 'Stripe secret key is required.' };
    if (!/^sk_(live|test)_/.test(key) && !/^rk_(live|test)_/.test(key)) {
      return { success: false, message: 'That does not look like a Stripe secret key (expected sk_live_… / sk_test_…).' };
    }
    try {
      const res = await fetchWithTimeout('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const mode = key.includes('_test_') ? 'test' : 'live';
        return { success: true, message: `Stripe secret key valid (${mode} mode). Balance endpoint reachable.` };
      }
      if (res.status === 401) return { success: false, message: 'Invalid Stripe secret key (401 unauthorized).' };
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { success: false, message: data?.error?.message || `Stripe returned HTTP ${res.status}.` };
    } catch (err) {
      return { success: false, message: describeNetworkError(err) };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    if (!this.checkConfigured()) {
      return { status: 'degraded', latencyMs: 0, message: 'Stripe not configured.', checkedAt: new Date().toISOString() };
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

export class NoopPaymentAdapter extends FallbackAdapter implements IPaymentAdapter {
  readonly id = 'noop';
  readonly name = 'No-op Payment (fallback)';
  readonly serviceType: PlatformServiceType = 'PAYMENT';

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntentResult> {
    logger.info('[PAYMENT:noop] Mock payment intent', { amount: params.amount });
    const id = `mock_${crypto.randomUUID()}`;
    return { success: true, intentId: id, clientSecret: `${id}_secret`, provider: 'noop' };
  }
}
