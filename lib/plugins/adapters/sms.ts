import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import { PlatformServiceType, ISmsAdapter, SmsResult } from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
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
    logger.info('Twilio send (stub)', { to: params.to });
    return { success: true, messageId: crypto.randomUUID(), provider: 'twilio' };
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
