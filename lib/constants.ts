/**
 * Platform constants — seeded RBAC catalog, default feature flags, and
 * platform-default configuration values. These are the SEED sources of truth;
 * at runtime everything is read from the database (configuration-first).
 */

// ── Permission catalog: {module}:{resource}:{action} ──
export const PERMISSIONS: { resource: string; action: string; description: string }[] = [
  { resource: 'catalogue:categories', action: 'read', description: 'View categories' },
  { resource: 'catalogue:categories', action: 'write', description: 'Create/update categories' },
  { resource: 'catalogue:categories', action: 'delete', description: 'Delete categories' },
  { resource: 'catalogue:products', action: 'read', description: 'View products' },
  { resource: 'catalogue:products', action: 'write', description: 'Create/update products' },
  { resource: 'catalogue:products', action: 'delete', description: 'Delete products' },
  { resource: 'branding:brand', action: 'read', description: 'View brand' },
  { resource: 'branding:brand', action: 'write', description: 'Update brand' },
  { resource: 'branding:theme', action: 'read', description: 'View theme' },
  { resource: 'branding:theme', action: 'write', description: 'Update theme' },
  { resource: 'branding:assets', action: 'write', description: 'Upload brand assets' },
  { resource: 'branding:assets', action: 'delete', description: 'Delete brand assets' },
  { resource: 'identity:users', action: 'read', description: 'View users' },
  { resource: 'identity:users', action: 'write', description: 'Create/update users' },
  { resource: 'identity:users', action: 'delete', description: 'Delete users' },
  { resource: 'identity:roles', action: 'read', description: 'View roles' },
  { resource: 'identity:roles', action: 'write', description: 'Create/update roles' },
  { resource: 'identity:audit', action: 'read', description: 'View audit logs' },
  { resource: 'config:settings', action: 'read', description: 'View configuration' },
  { resource: 'config:settings', action: 'write', description: 'Update configuration' },
  { resource: 'services:platform', action: 'read', description: 'View platform services' },
  { resource: 'services:platform', action: 'write', description: 'Update platform services' },
  { resource: 'services:platform', action: 'test', description: 'Test service connections' },
  { resource: 'feature_flags:flags', action: 'read', description: 'View feature flags' },
  { resource: 'feature_flags:flags', action: 'write', description: 'Update feature flags' },
  { resource: 'theme_content:homepage', action: 'read', description: 'View homepage content' },
  { resource: 'theme_content:homepage', action: 'write', description: 'Update homepage content' },
  { resource: 'theme_content:navigation', action: 'read', description: 'View navigation' },
  { resource: 'theme_content:navigation', action: 'write', description: 'Update navigation' },
  { resource: 'theme_content:seo', action: 'read', description: 'View SEO settings' },
  { resource: 'theme_content:seo', action: 'write', description: 'Update SEO settings' },
  { resource: 'theme_content:contact', action: 'read', description: 'View contact info' },
  { resource: 'theme_content:contact', action: 'write', description: 'Update contact info' },
  // Ordering
  { resource: 'ordering:orders', action: 'read', description: 'View orders' },
  { resource: 'ordering:orders', action: 'write', description: 'Update order status' },
  { resource: 'ordering:orders', action: 'delete', description: 'Cancel/delete orders' },
  { resource: 'ordering:customers', action: 'read', description: 'View customers' },
  { resource: 'ordering:customers', action: 'write', description: 'Update customers' },
  // Kitchen
  { resource: 'kitchen:queue', action: 'read', description: 'View kitchen queue' },
  { resource: 'kitchen:queue', action: 'write', description: 'Update order prep status' },
  { resource: 'kitchen:settings', action: 'read', description: 'View kitchen settings' },
  { resource: 'kitchen:settings', action: 'write', description: 'Update kitchen settings' },
  // ── Analytics ──
  { resource: 'analytics:dashboard', action: 'read', description: 'View analytics dashboard' },
  { resource: 'analytics:reports', action: 'read', description: 'View detailed reports' },
  { resource: 'analytics:reports', action: 'export', description: 'Export analytics data' },
  // ── Notifications ──
  { resource: 'notifications:settings', action: 'read', description: 'View notification settings' },
  { resource: 'notifications:settings', action: 'write', description: 'Update notification settings' },
  { resource: 'notifications:logs', action: 'read', description: 'View notification history' },
  // ── Discounts ──
  { resource: 'discounts:codes', action: 'read', description: 'View discount codes' },
  { resource: 'discounts:codes', action: 'write', description: 'Create/update discount codes' },
  { resource: 'discounts:codes', action: 'delete', description: 'Delete discount codes' },
];

/** Build the full permission string. */
export function permKey(resource: string, action: string): string {
  return `${resource}:${action}`;
}

export interface RoleDefinition {
  name: string;
  displayName: string;
  description: string;
  isSystem: boolean;
  /** Wildcard patterns matched against permission keys. '*' = all. */
  permissions: string[];
}

export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    name: 'super_admin',
    displayName: 'Super Admin',
    description: 'Platform owner. Full access to all tenants.',
    isSystem: true,
    permissions: ['*'],
  },
  {
    name: 'tenant_admin',
    displayName: 'Tenant Admin',
    description: 'Tenant owner. Full access within their tenant.',
    isSystem: true,
    permissions: ['*'],
  },
  {
    name: 'manager',
    displayName: 'Manager',
    description: 'Manages catalogue, branding, and content.',
    isSystem: true,
    permissions: [
      'catalogue:*:read',
      'catalogue:*:write',
      'branding:*:*',
      'theme_content:*:read',
      'theme_content:*:write',
    ],
  },
  {
    name: 'staff',
    displayName: 'Staff',
    description: 'Day-to-day operations. Limited write access.',
    isSystem: true,
    permissions: ['catalogue:*:read', 'theme_content:*:read'],
  },
  {
    name: 'customer',
    displayName: 'Customer',
    description: 'End customer. Read-only catalogue access.',
    isSystem: true,
    permissions: ['catalogue:*:read'],
  },
];

// ── Default feature flags (Phase 1) ──
export interface FeatureFlagDefinition {
  key: string;
  name: string;
  description: string;
  module: string;
  type: 'BOOLEAN' | 'PERCENTAGE' | 'VARIANT';
  defaultValue: boolean | number | string;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlagDefinition[] = [
  { key: 'catalogue.enabled', name: 'Catalogue Module', description: 'Enable catalogue module', module: 'catalogue', type: 'BOOLEAN', defaultValue: true },
  { key: 'catalogue.variants.enabled', name: 'Product Variants', description: 'Enable product variants', module: 'catalogue', type: 'BOOLEAN', defaultValue: true },
  { key: 'catalogue.modifiers.enabled', name: 'Product Modifiers', description: 'Enable product modifiers', module: 'catalogue', type: 'BOOLEAN', defaultValue: true },
  { key: 'branding.dark_mode.enabled', name: 'Dark Mode', description: 'Enable dark mode theme', module: 'branding', type: 'BOOLEAN', defaultValue: false },
  { key: 'branding.custom_css.enabled', name: 'Custom CSS', description: 'Enable custom CSS', module: 'branding', type: 'BOOLEAN', defaultValue: false },
  { key: 'homepage.promotional_banners.enabled', name: 'Promotional Banners', description: 'Show promotional banners', module: 'homepage', type: 'BOOLEAN', defaultValue: true },
  { key: 'homepage.testimonials.enabled', name: 'Testimonials', description: 'Show testimonials section', module: 'homepage', type: 'BOOLEAN', defaultValue: false },
  { key: 'services.email.enabled', name: 'Email Sending', description: 'Enable email sending', module: 'services', type: 'BOOLEAN', defaultValue: false },
  { key: 'services.sms.enabled', name: 'SMS Sending', description: 'Enable SMS sending', module: 'services', type: 'BOOLEAN', defaultValue: false },
  { key: 'services.analytics.enabled', name: 'Analytics', description: 'Enable analytics tracking', module: 'services', type: 'BOOLEAN', defaultValue: false },
  { key: 'ordering.enabled', name: 'Ordering', description: 'Enable ordering (Phase 2)', module: 'ordering', type: 'BOOLEAN', defaultValue: false },
  { key: 'customer.accounts.enabled', name: 'Customer Accounts', description: 'Enable customer accounts (Phase 2)', module: 'customer', type: 'BOOLEAN', defaultValue: false },
  { key: 'backoffice.audit_viewer.enabled', name: 'Audit Viewer', description: 'Show audit log viewer', module: 'backoffice', type: 'BOOLEAN', defaultValue: true },
];

// ── Platform default configuration (tenantId = null) ──
export interface ConfigDefault {
  module: string;
  key: string;
  value: unknown;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'ENCRYPTED' | 'COLOR' | 'URL' | 'EMAIL';
  isPublic: boolean;
  isSecret?: boolean;
  description?: string;
}

export const DEFAULT_CONFIGURATION: ConfigDefault[] = [
  // platform
  { module: 'platform', key: 'timezone', value: 'Europe/London', type: 'STRING', isPublic: true, description: 'Default timezone' },
  { module: 'platform', key: 'currency', value: 'GBP', type: 'STRING', isPublic: true, description: 'Default currency code' },
  { module: 'platform', key: 'locale', value: 'en-GB', type: 'STRING', isPublic: true, description: 'Default locale' },
  { module: 'platform', key: 'dateFormat', value: 'dd/MM/yyyy', type: 'STRING', isPublic: true, description: 'Default date format' },
  { module: 'platform', key: 'measurementUnit', value: 'metric', type: 'STRING', isPublic: true, description: 'Measurement system' },
  // catalogue
  { module: 'catalogue', key: 'currency', value: 'GBP', type: 'STRING', isPublic: true, description: 'Catalogue currency' },
  { module: 'catalogue', key: 'taxRate', value: 20, type: 'NUMBER', isPublic: true, description: 'Default tax rate percent' },
  { module: 'catalogue', key: 'showPricesWithTax', value: true, type: 'BOOLEAN', isPublic: true, description: 'Display tax-inclusive prices' },
  { module: 'catalogue', key: 'maxProductsPerCategory', value: 500, type: 'NUMBER', isPublic: false, description: 'Max products per category' },
  // seo
  { module: 'seo', key: 'siteTitle', value: 'The Steak Sheikh', type: 'STRING', isPublic: true, description: 'Default site title' },
  { module: 'seo', key: 'siteDescription', value: 'Delicious food, delivered.', type: 'STRING', isPublic: true, description: 'Default site description' },
  // notifications
  { module: 'notifications', key: 'emailEnabled', value: false, type: 'BOOLEAN', isPublic: false, description: 'Email notifications enabled' },
  { module: 'notifications', key: 'smsEnabled', value: false, type: 'BOOLEAN', isPublic: false, description: 'SMS notifications enabled' },
  { module: 'notifications', key: 'pushEnabled', value: false, type: 'BOOLEAN', isPublic: false, description: 'Push notifications enabled' },
  // services (active plugin selections)
  { module: 'services', key: 'emailProvider', value: 'console', type: 'STRING', isPublic: false, description: 'Active email provider' },
  { module: 'services', key: 'smsProvider', value: 'console', type: 'STRING', isPublic: false, description: 'Active SMS provider' },
  { module: 'services', key: 'storageProvider', value: 's3', type: 'STRING', isPublic: false, description: 'Active storage provider' },
  { module: 'services', key: 'paymentProvider', value: 'noop', type: 'STRING', isPublic: false, description: 'Active payment provider' },
];

export const SESSION_COOKIE = 'dk_session';
export const CSRF_COOKIE = 'dk_csrf';
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h
export const SESSION_CACHE_TTL_SECONDS = 60 * 10; // 10m
export const PERMISSIONS_CACHE_TTL_SECONDS = 60 * 10;
export const MAX_SESSIONS_PER_USER = 5;
