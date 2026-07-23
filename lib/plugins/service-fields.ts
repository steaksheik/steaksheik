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
}

export interface ServiceMeta {
  serviceType: string;
  category: string;
  label: string;
  provider: string;
  description: string;
  docsUrl?: string;
  fields: ServiceFieldDef[];
}

export const SERVICE_META: Record<string, ServiceMeta> = {
  EMAIL: {
    serviceType: 'EMAIL',
    category: 'Communications',
    label: 'Transactional Email',
    provider: 'Amazon SES',
    description: 'Send order confirmations, receipts and alerts via Amazon SES.',
    docsUrl: 'https://console.aws.amazon.com/ses',
    fields: [
      { key: 'accessKeyId', label: 'AWS Access Key ID', kind: 'credential', required: true, placeholder: 'AKIA...' },
      { key: 'secretAccessKey', label: 'AWS Secret Access Key', kind: 'credential', secret: true, required: true },
      { key: 'region', label: 'AWS Region', kind: 'credential', required: true, placeholder: 'eu-west-2' },
      { key: 'fromEmail', label: 'Default From Address', kind: 'config', placeholder: 'orders@yourdomain.com' },
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
      { key: 'accountSid', label: 'Account SID', kind: 'credential', required: true, placeholder: 'AC...' },
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
      { key: 'bucketName', label: 'Bucket Name', kind: 'credential', required: true, placeholder: 'my-kitchen-assets' },
      { key: 'region', label: 'AWS Region', kind: 'credential', required: true, placeholder: 'eu-west-2' },
      { key: 'accessKeyId', label: 'AWS Access Key ID', kind: 'credential', required: true, placeholder: 'AKIA...' },
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
      { key: 'distributionId', label: 'Distribution ID', kind: 'credential', required: true, placeholder: 'E1ABCDEF...' },
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
      { key: 'zoneId', label: 'Zone ID', kind: 'credential', required: true },
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
