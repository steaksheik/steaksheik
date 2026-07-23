import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import {
  PlatformServiceType,
  IEmailAdapter,
  EmailParams,
  EmailResult,
  HealthCheckResult,
  ConnectionTestResult,
} from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
import { extractAwsError, awsTestMessage, verboseServiceErrors } from '@/lib/plugins/adapters/_http';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Email provider identifiers. The admin backend picks one of these
// via the "provider" field on the EMAIL service. Everything is stored
// encrypted at rest and reconfigured into the adapter at runtime.
// ─────────────────────────────────────────────────────────────
export type EmailProvider = 'ses' | 'smtp' | 'resend';

function firstRecipient(to: string | string[]): string {
  return Array.isArray(to) ? to[0] ?? '' : to;
}

function resolveFrom(config: Record<string, unknown>, override?: string): string {
  if (override) return override;
  const email = String(config.fromEmail ?? '').trim();
  const name = String(config.fromName ?? '').trim();
  if (!email) return '';
  return name ? `${name} <${email}>` : email;
}

// ─────────────────────────────────────────────────────────────
// SES provider (kept as-is: presence-validated stub). AWS SES live
// send requires the AWS SDK + verified identity; credentials flow
// through here for when that is wired to real infrastructure.
// ─────────────────────────────────────────────────────────────
class SesProvider {
  readonly id: EmailProvider = 'ses';
  readonly name = 'Amazon SES';

  isConfigured(config: Record<string, unknown>): boolean {
    return Boolean(config.accessKeyId && config.secretAccessKey && config.region);
  }

  async send(config: Record<string, unknown>, params: EmailParams): Promise<EmailResult> {
    if (!this.isConfigured(config)) throw new Error('SES not configured');
    // Live SES send would go here (AWS SDK). Kept as existing behaviour.
    logger.info('SES send (stub)', { to: params.to, subject: params.subject });
    return { success: true, messageId: crypto.randomUUID(), provider: 'ses' };
  }

  async test(config: Record<string, unknown>): Promise<ConnectionTestResult> {
    if (!this.isConfigured(config)) {
      return { success: false, message: 'Amazon SES: access key, secret and region are required' };
    }
    const region = String(config.region);
    try {
      // REAL authenticated SES call — GetSendQuota verifies the key, secret and
      // region without sending anything.
      const { SESClient, GetSendQuotaCommand } = await import('@aws-sdk/client-ses');
      const client = new SESClient({
        region,
        credentials: {
          accessKeyId: String(config.accessKeyId),
          secretAccessKey: String(config.secretAccessKey),
        },
      });
      const quota = await client.send(new GetSendQuotaCommand({}));
      return {
        success: true,
        message: `Amazon SES connected in ${region}. Send quota: ${quota.SentLast24Hours ?? 0}/${quota.Max24HourSend ?? 0} in last 24h.`,
        details: { region, max24HourSend: quota.Max24HourSend, maxSendRate: quota.MaxSendRate },
      };
    } catch (err) {
      const info = extractAwsError(err);
      // Always log the full, original AWS SDK error server-side.
      logger.error('SES connection test failed', {
        region,
        awsErrorName: info.name,
        awsErrorMessage: info.message,
        awsErrorCode: info.code,
        httpStatusCode: info.httpStatusCode,
        requestId: info.requestId,
      });
      return {
        success: false,
        message: awsTestMessage(this.friendlyError(info, region), info),
        details: verboseServiceErrors() ? (info as unknown as Record<string, unknown>) : undefined,
      };
    }
  }

  private friendlyError(info: { name?: string; code?: string; httpStatusCode?: number }, region: string): string {
    const code = info.name || info.code || '';
    if (code === 'InvalidClientTokenId') return 'The AWS Access Key ID is not valid.';
    if (code === 'SignatureDoesNotMatch') return 'The AWS Secret Access Key is incorrect.';
    if (code === 'AccessDenied' || info.httpStatusCode === 403) {
      return 'Access denied — the access key lacks SES permission (need ses:GetSendQuota / ses:SendEmail).';
    }
    if (code === 'UnrecognizedClientException') return 'Credentials not recognised for SES.';
    if (code === 'UnknownEndpoint' || code === 'NetworkingError') {
      return `Could not reach SES for region "${region}". Check the region value.`;
    }
    return 'Amazon SES connection failed.';
  }
}

// ─────────────────────────────────────────────────────────────
// SMTP provider (real send via nodemailer). Covers Gmail /
// Google Workspace, Microsoft 365 / Outlook, webmail (cPanel, etc.)
// and any standards-compliant SMTP server.
// ─────────────────────────────────────────────────────────────
class SmtpProvider {
  readonly id: EmailProvider = 'smtp';
  readonly name = 'SMTP';

  isConfigured(config: Record<string, unknown>): boolean {
    return Boolean(config.host && config.username && config.password);
  }

  private buildTransportOptions(config: Record<string, unknown>) {
    const port = Number(config.port ?? 587);
    // "secure" true => implicit TLS (port 465). false => STARTTLS (587/25).
    const secure =
      config.secure === true || config.secure === 'true' || port === 465;
    return {
      host: String(config.host),
      port,
      secure,
      auth: {
        user: String(config.username),
        pass: String(config.password),
      },
    };
  }

  async send(config: Record<string, unknown>, params: EmailParams): Promise<EmailResult> {
    if (!this.isConfigured(config)) throw new Error('SMTP not configured');
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport(this.buildTransportOptions(config));
    const from = resolveFrom(config, params.from) || String(config.username);
    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });
    logger.info('[EMAIL:smtp] sent', { to: params.to, subject: params.subject, messageId: info.messageId });
    return { success: true, messageId: info.messageId, provider: 'smtp' };
  }

  async test(config: Record<string, unknown>): Promise<ConnectionTestResult> {
    if (!this.isConfigured(config)) {
      return { success: false, message: 'SMTP: host, username and password are required' };
    }
    try {
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport(this.buildTransportOptions(config));
      await transporter.verify();
      return {
        success: true,
        message: `SMTP: connection to ${String(config.host)} verified successfully`,
        details: { host: config.host, port: config.port ?? 587 },
      };
    } catch (err) {
      return { success: false, message: `SMTP connection failed: ${(err as Error).message}` };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Resend provider (real send via Resend HTTP API — no SDK needed).
// ─────────────────────────────────────────────────────────────
class ResendProvider {
  readonly id: EmailProvider = 'resend';
  readonly name = 'Resend';

  isConfigured(config: Record<string, unknown>): boolean {
    return Boolean(config.apiKey && (config.fromEmail || config.from));
  }

  async send(config: Record<string, unknown>, params: EmailParams): Promise<EmailResult> {
    const apiKey = String(config.apiKey ?? '');
    if (!apiKey) throw new Error('Resend not configured');
    const from = resolveFrom(config, params.from);
    if (!from) throw new Error('Resend requires a verified "From" address');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || `Resend API error (${res.status})`);
    }
    logger.info('[EMAIL:resend] sent', { to: params.to, subject: params.subject, id: data?.id });
    return { success: true, messageId: data?.id, provider: 'resend' };
  }

  async test(config: Record<string, unknown>): Promise<ConnectionTestResult> {
    const apiKey = String(config.apiKey ?? '');
    if (!apiKey) return { success: false, message: 'Resend: API key is required' };
    try {
      // Lightweight authenticated call to validate the API key.
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Resend: API key rejected (unauthorized)' };
      }
      if (!res.ok) {
        return { success: false, message: `Resend: unexpected response (${res.status})` };
      }
      return { success: true, message: 'Resend: API key verified successfully' };
    } catch (err) {
      return { success: false, message: `Resend connection failed: ${(err as Error).message}` };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Multi-provider email adapter — the single EMAIL primary registered
// in the plugin registry. It delegates to the provider selected in
// the admin backend (config.provider), defaulting to SES so existing
// behaviour is preserved.
// ─────────────────────────────────────────────────────────────
export class MultiProviderEmailAdapter extends BaseAdapter implements IEmailAdapter {
  readonly id = 'email';
  readonly name = 'Transactional Email';
  readonly serviceType: PlatformServiceType = 'EMAIL';

  private providers: Record<EmailProvider, SesProvider | SmtpProvider | ResendProvider> = {
    ses: new SesProvider(),
    smtp: new SmtpProvider(),
    resend: new ResendProvider(),
  };

  private selectedProvider(): EmailProvider {
    const p = String(this.config?.provider ?? 'ses').toLowerCase();
    if (p === 'smtp' || p === 'resend' || p === 'ses') return p;
    return 'ses';
  }

  private active() {
    return this.providers[this.selectedProvider()];
  }

  protected checkConfigured(): boolean {
    return this.active().isConfigured(this.config ?? {});
  }

  async send(params: EmailParams): Promise<EmailResult> {
    const provider = this.active();
    if (!provider.isConfigured(this.config ?? {})) {
      throw new Error(`${provider.name} not configured`);
    }
    return provider.send(this.config ?? {}, params);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const provider = this.active();
    const configured = provider.isConfigured(this.config ?? {});
    return {
      status: configured ? 'healthy' : 'degraded',
      latencyMs: 0,
      message: configured
        ? `${provider.name} configured`
        : `${provider.name} not configured — using graceful fallback`,
      checkedAt: new Date().toISOString(),
    };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    // Merge any freshly-supplied values over the loaded runtime config so a
    // test reflects exactly what the admin just entered.
    const merged = { ...(this.config ?? {}), ...(credentials ?? {}) };
    const providerId = String(merged.provider ?? this.selectedProvider()).toLowerCase();
    const provider =
      this.providers[(['ses', 'smtp', 'resend'].includes(providerId) ? providerId : 'ses') as EmailProvider];
    return provider.test(merged);
  }
}

// ─────────────────────────────────────────────────────────────
// Console fallback — never fails; used until a provider is configured
// and enabled. Keeps order processing unblocked.
// ─────────────────────────────────────────────────────────────
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

// Backwards-compatible export: the old name still resolves to an email
// adapter so any lingering imports keep working.
export const SesEmailAdapter = MultiProviderEmailAdapter;
