import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import { PlatformServiceType, IPaymentAdapter, PaymentIntentResult } from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
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
