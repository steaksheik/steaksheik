import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import { PlatformServiceType, IEmailAdapter, EmailParams, EmailResult } from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export class SesEmailAdapter extends BaseAdapter implements IEmailAdapter {
  readonly id = 'ses';
  readonly name = 'Amazon SES';
  readonly serviceType: PlatformServiceType = 'EMAIL';

  protected checkConfigured(): boolean {
    return Boolean(this.config?.accessKeyId && this.config?.secretAccessKey && this.config?.region);
  }

  async send(params: EmailParams): Promise<EmailResult> {
    if (!this.isConfigured()) throw new Error('SES not configured');
    // Live SES send would go here (AWS SDK). Credentials pending.
    logger.info('SES send (stub)', { to: params.to, subject: params.subject });
    return { success: true, messageId: crypto.randomUUID(), provider: 'ses' };
  }
}

export class ConsoleEmailAdapter extends FallbackAdapter implements IEmailAdapter {
  readonly id = 'console';
  readonly name = 'Console Email (fallback)';
  readonly serviceType: PlatformServiceType = 'EMAIL';

  async send(params: EmailParams): Promise<EmailResult> {
    logger.info('[EMAIL:console] Would send email', {
      to: params.to,
      subject: params.subject,
      preview: params.text?.slice(0, 120) ?? params.html?.slice(0, 120),
    });
    return { success: true, messageId: `console-${crypto.randomUUID()}`, provider: 'console' };
  }
}
