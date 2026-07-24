// Frontend metadata describing the credential + setting fields each platform
// service adapter requires. Mirrors the `checkConfigured()` contracts of the
// adapters in lib/plugins/adapters/*. Used by the admin Platform Services UI to
// render dynamic configuration forms. Secret fields are rendered masked and are
// encrypted at rest server-side via encryptCredentials().

export interface ServiceFieldDef {
  key: string;
  label: string;
  /** credential (encrypted, sensitive) vs. config (plain settings) */
  kind: 'credential' | 'config';
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** input type — defaults to text. `select` renders a dropdown. */
    type?: 'text' | 'select' | 'number' | 'textarea';
  /** options for `select` fields */
  options?: { value: string; label: string }[];
  /** default value applied when the form opens with no stored value */
  default?: string;
  /** only show this field when another field's value is one of `in` */
  showIf?: { key: string; in: string[] };
}

/** A one-click preset that autofills a set of field values (e.g. SMTP hosts). */
export interface ServicePreset {
  label: string;
  /** preset only applies while this field equals one of `when` */
  when?: { key: string; in: string[] };
  values: Record<string, string>;
  hint?: string;
}

export interface ServiceMeta {
  serviceType: string;
  category: string;
  label: string;
  provider: string;
  description: string;
  docsUrl?: string;
  fields: ServiceFieldDef[];
  presets?: ServicePreset[];
}

export const SERVICE_META: Record<string, ServiceMeta> = {
  EMAIL: {
    serviceType: 'EMAIL',
    category: 'Communications',
    label: 'Transactional Email',
    provider: 'SES · SMTP · Resend',
    description:
      'Send order confirmations, receipts and alerts. Choose your provider — Amazon SES, any SMTP server (Gmail, Microsoft 365, webmail) or Resend.',
    docsUrl: 'https://resend.com/docs',
    fields: [
      {
        key: 'provider',
        label: 'Email Provider',
        kind: 'config',
        type: 'select',
        required: true,
        default: 'ses',
        help: 'Pick which service sends your emails. SMTP covers Gmail, Microsoft 365 and most webmail hosts.',
        options: [
          { value: 'ses', label: 'Amazon SES' },
          { value: 'smtp', label: 'SMTP (Gmail / Microsoft 365 / Webmail)' },
          { value: 'resend', label: 'Resend' },
        ],
      },

      // Shared sender identity (used by all providers)
      { key: 'fromEmail', label: 'From Address', kind: 'config', required: true, placeholder: 'orders@yourdomain.com', help: 'The address recipients see. Must be verified/authorised with your provider.' },
      { key: 'fromName', label: 'From Name', kind: 'config', placeholder: 'The Steak Sheikh' },

      // ── Amazon SES ──
      { key: 'accessKeyId', label: 'AWS Access Key ID', kind: 'credential', required: true, placeholder: 'AKIA...', showIf: { key: 'provider', in: ['ses'] } },
      { key: 'secretAccessKey', label: 'AWS Secret Access Key', kind: 'credential', secret: true, required: true, showIf: { key: 'provider', in: ['ses'] } },
      { key: 'region', label: 'AWS Region', kind: 'config', required: true, placeholder: 'eu-west-2', showIf: { key: 'provider', in: ['ses'] } },

      // ── SMTP (Gmail / Microsoft 365 / Webmail / any host) ──
      { key: 'host', label: 'SMTP Host', kind: 'config', required: true, placeholder: 'smtp.gmail.com', showIf: { key: 'provider', in: ['smtp'] } },
      { key: 'port', label: 'SMTP Port', kind: 'config', type: 'number', required: true, default: '587', placeholder: '587', help: '587 for STARTTLS (recommended) or 465 for SSL.', showIf: { key: 'provider', in: ['smtp'] } },
      { key: 'secure', label: 'Use SSL (port 465)', kind: 'config', type: 'select', default: 'false', options: [{ value: 'false', label: 'No — STARTTLS (587)' }, { value: 'true', label: 'Yes — SSL/TLS (465)' }], showIf: { key: 'provider', in: ['smtp'] } },
      { key: 'username', label: 'SMTP Username', kind: 'config', required: true, placeholder: 'you@gmail.com', help: 'Usually your full email address.', showIf: { key: 'provider', in: ['smtp'] } },
      { key: 'password', label: 'SMTP Password / App Password', kind: 'credential', secret: true, required: true, help: 'For Gmail & Microsoft 365 use an App Password (not your normal login password).', showIf: { key: 'provider', in: ['smtp'] } },

      // ── Resend ──
      { key: 'apiKey', label: 'Resend API Key', kind: 'credential', secret: true, required: true, placeholder: 're_...', showIf: { key: 'provider', in: ['resend'] } },
    ],
    presets: [
      { label: 'Gmail / Google Workspace', when: { key: 'provider', in: ['smtp'] }, values: { host: 'smtp.gmail.com', port: '587', secure: 'false' }, hint: 'Requires a Google App Password (2-Step Verification must be on).' },
      { label: 'Microsoft 365 / Outlook', when: { key: 'provider', in: ['smtp'] }, values: { host: 'smtp.office365.com', port: '587', secure: 'false' }, hint: 'Use an App Password if MFA is enabled on the account.' },
      { label: 'Webmail (cPanel / generic)', when: { key: 'provider', in: ['smtp'] }, values: { host: 'mail.yourdomain.com', port: '465', secure: 'true' }, hint: 'Replace the host with your hosting provider\u2019s mail server.' },
    ],
  },
  SMS: {
    serviceType: 'SMS',
    category: 'Communications',
    label: 'SMS Messaging',
    provider: 'Twilio',
    description: 'Send delivery and order status text messages via Twilio.',
    docsUrl: 'https://console.twilio.com',
    fields: [
      { key: 'accountSid', label: 'Account SID', kind: 'config', required: true, placeholder: 'AC...' },
      { key: 'authToken', label: 'Auth Token', kind: 'credential', secret: true, required: true },
      { key: 'fromNumber', label: 'From Number', kind: 'config', placeholder: '+441234567890' },
    ],
  },
  STORAGE: {
    serviceType: 'STORAGE',
    category: 'Infrastructure',
    label: 'Object Storage',
    provider: 'Amazon S3',
    description: 'Store menu images, brand assets and uploads in an S3 bucket.',
    docsUrl: 'https://console.aws.amazon.com/s3',
    fields: [
      { key: 'bucketName', label: 'Bucket Name', kind: 'config', required: true, placeholder: 'my-kitchen-assets' },
      { key: 'region', label: 'AWS Region', kind: 'config', required: true, placeholder: 'eu-west-2' },
      { key: 'accessKeyId', label: 'AWS Access Key ID', kind: 'config', required: true, placeholder: 'AKIA...' },
      { key: 'secretAccessKey', label: 'AWS Secret Access Key', kind: 'credential', secret: true, required: true },
    ],
  },
  PAYMENT: {
    serviceType: 'PAYMENT',
    category: 'Commerce',
    label: 'Payments',
    provider: 'Stripe',
    description: 'Accept card payments and process checkouts via Stripe.',
    docsUrl: 'https://dashboard.stripe.com/apikeys',
    fields: [
      { key: 'secretKey', label: 'Secret Key', kind: 'credential', secret: true, required: true, placeholder: 'sk_live_...' },
      { key: 'publishableKey', label: 'Publishable Key', kind: 'config', placeholder: 'pk_live_...' },
      { key: 'webhookSecret', label: 'Webhook Signing Secret', kind: 'credential', secret: true, placeholder: 'whsec_...' },
    ],
  },
  MAPS: {
    serviceType: 'MAPS',
    category: 'Infrastructure',
    label: 'Maps & Geocoding',
    provider: 'Google Maps',
    description: 'Geocode delivery addresses and render maps via Google Maps.',
    docsUrl: 'https://console.cloud.google.com/google/maps-apis',
    fields: [
      { key: 'apiKey', label: 'API Key', kind: 'credential', secret: true, required: true, placeholder: 'AIza...' },
    ],
  },
  CDN: {
    serviceType: 'CDN',
    category: 'Infrastructure',
    label: 'Content Delivery',
    provider: 'Amazon CloudFront',
    description: 'Serve assets globally and invalidate caches via CloudFront.',
    docsUrl: 'https://console.aws.amazon.com/cloudfront',
    fields: [
      { key: 'distributionId', label: 'Distribution ID', kind: 'config', required: true, placeholder: 'E1ABCDEF...' },
      { key: 'domain', label: 'Distribution Domain', kind: 'config', required: true, placeholder: 'd123.cloudfront.net' },
    ],
  },
  DNS_CDN: {
    serviceType: 'DNS_CDN',
    category: 'Infrastructure',
    label: 'DNS & Edge CDN',
    provider: 'Cloudflare',
    description: 'Manage DNS, edge caching and cache purges via Cloudflare.',
    docsUrl: 'https://dash.cloudflare.com',
    fields: [
      { key: 'apiToken', label: 'API Token', kind: 'credential', secret: true, required: true },
      { key: 'zoneId', label: 'Zone ID', kind: 'config', required: true },
    ],
  },
  ANALYTICS_GA4: {
    serviceType: 'ANALYTICS_GA4',
    category: 'Analytics',
    label: 'Analytics (GA4)',
    provider: 'Google Analytics 4',
    description: 'Track storefront traffic and conversions with GA4.',
    docsUrl: 'https://analytics.google.com',
    fields: [
      { key: 'measurementId', label: 'Measurement ID', kind: 'config', required: true, placeholder: 'G-XXXXXXX' },
      {
        key: 'propertyId',
        label: 'GA4 Property ID',
        kind: 'config',
        placeholder: '123456789',
        help: 'The numeric Property ID (not the Measurement ID above) — GA4 Admin → Property Settings. Only needed to show visitor reports in this dashboard; tracking itself works without it.',
      },
      {
        key: 'serviceAccountJson',
        label: 'Service Account JSON',
        kind: 'credential',
        secret: true,
        type: 'textarea',
        help: 'Paste the full JSON key from a Google Cloud service account. Steps: Google Cloud Console → enable "Google Analytics Data API" → create a service account → create a JSON key → in GA4 Admin → Property Access Management, add that service account’s email as a Viewer. Only needed for visitor reports in this dashboard.',
      },
    ],
  },
  ANALYTICS_GTM: {
    serviceType: 'ANALYTICS_GTM',
    category: 'Analytics',
    label: 'Tag Manager',
    provider: 'Google Tag Manager',
    description: 'Deploy marketing and analytics tags via GTM.',
    docsUrl: 'https://tagmanager.google.com',
    fields: [
      { key: 'containerId', label: 'Container ID', kind: 'config', required: true, placeholder: 'GTM-XXXXXX' },
    ],
  },
  ANALYTICS_PH: {
    serviceType: 'ANALYTICS_PH',
    category: 'Analytics',
    label: 'Product Analytics',
    provider: 'PostHog',
    description: 'Capture product events and funnels with PostHog.',
    docsUrl: 'https://posthog.com',
    fields: [
      { key: 'apiKey', label: 'Project API Key', kind: 'credential', secret: true, required: true, placeholder: 'phc_...' },
      { key: 'host', label: 'Instance Host', kind: 'config', placeholder: 'https://eu.posthog.com' },
    ],
  },
  ERROR_TRACKING: {
    serviceType: 'ERROR_TRACKING',
    category: 'Observability',
    label: 'Error Tracking',
    provider: 'Sentry',
    description: 'Capture runtime errors and stack traces via Sentry.',
    docsUrl: 'https://sentry.io',
    fields: [
      { key: 'dsn', label: 'DSN', kind: 'credential', secret: true, required: true, placeholder: 'https://...@sentry.io/...' },
    ],
  },
  UPTIME: {
    serviceType: 'UPTIME',
    category: 'Observability',
    label: 'Uptime Monitoring',
    provider: 'Better Stack',
    description: 'Monitor availability and get downtime alerts via Better Stack.',
    docsUrl: 'https://betterstack.com',
    fields: [
      { key: 'sourceToken', label: 'Source Token', kind: 'credential', secret: true, required: true },
    ],
  },
};

export function metaFor(serviceType: string): ServiceMeta | undefined {
  return SERVICE_META[serviceType];
}
