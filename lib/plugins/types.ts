export type PlatformServiceType =
  | 'EMAIL'
  | 'SMS'
  | 'STORAGE'
  | 'CDN'
  | 'PAYMENT'
  | 'MAPS'
  | 'ANALYTICS_GA4'
  | 'ANALYTICS_GTM'
  | 'ANALYTICS_PH'
  | 'DNS_CDN'
  | 'ERROR_TRACKING'
  | 'UPTIME';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  message?: string;
  checkedAt: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface IPluginAdapter {
  readonly id: string;
  readonly name: string;
  readonly serviceType: PlatformServiceType;
  readonly isFallback: boolean;
  initialize(config: Record<string, unknown>): Promise<void>;
  isConfigured(): boolean;
  healthCheck(): Promise<HealthCheckResult>;
  testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult>;
}

// ── Domain-specific adapter contracts ──
export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}
export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
}
export interface IEmailAdapter extends IPluginAdapter {
  send(params: EmailParams): Promise<EmailResult>;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  provider: string;
}
export interface ISmsAdapter extends IPluginAdapter {
  send(params: { to: string; body: string; from?: string }): Promise<SmsResult>;
}

export interface StorageResult {
  success: boolean;
  key: string;
  url?: string;
}
export interface StorageUploadResult {
  success: boolean;
  key: string;
  url?: string;
  error?: string;
}
export interface IStorageAdapter extends IPluginAdapter {
  upload(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string,
    extra?: Record<string, unknown>,
  ): Promise<StorageUploadResult>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): string;
  /** Optional — remove an object from storage. Callers should treat a missing implementation as a no-op. */
  delete?(key: string): Promise<{ success: boolean; error?: string }>;
}

export interface PaymentIntentResult {
  success: boolean;
  intentId: string;
  clientSecret?: string;
  provider: string;
}
export interface IPaymentAdapter extends IPluginAdapter {
  createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntentResult>;
}

export interface ICdnAdapter extends IPluginAdapter {
  invalidate(paths: string[]): Promise<void>;
  getDistributionUrl(key: string): string;
}

export interface GeocodingResult {
  success: boolean;
  lat: number;
  lng: number;
  formattedAddress?: string;
}
export interface IMapsAdapter extends IPluginAdapter {
  geocode(address: string): Promise<GeocodingResult>;
}

export interface IAnalyticsAdapter extends IPluginAdapter {
  trackEvent(event: { name: string; properties?: Record<string, unknown>; userId?: string }): Promise<void>;
  getClientSnippet(): string;
}

export interface IMonitoringAdapter extends IPluginAdapter {
  captureError(error: Error, context?: Record<string, unknown>): void;
  captureMessage(message: string, level: 'info' | 'warning' | 'error'): void;
}
