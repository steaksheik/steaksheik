import { z } from 'zod';

/**
 * Per-module, per-key Zod validation schemas. Values written to configuration
 * are validated against these before persistence. Unknown keys default to a
 * permissive schema (any JSON) so new keys can be added without code changes,
 * but known business keys are strictly validated.
 */
const schemas: Record<string, z.ZodTypeAny> = {
  'platform:timezone': z.string().min(1),
  'platform:currency': z.string().length(3),
  'platform:locale': z.string().min(2),
  'platform:dateFormat': z.string().min(1),
  'platform:measurementUnit': z.enum(['metric', 'imperial']),
  'catalogue:currency': z.string().length(3),
  'catalogue:taxRate': z.number().min(0).max(100),
  'catalogue:showPricesWithTax': z.boolean(),
  'catalogue:maxProductsPerCategory': z.number().int().positive(),
  'seo:siteTitle': z.string().min(1).max(200),
  'seo:siteDescription': z.string().max(500),
  'notifications:emailEnabled': z.boolean(),
  'notifications:smsEnabled': z.boolean(),
  'notifications:pushEnabled': z.boolean(),
  'services:emailProvider': z.string().min(1),
  'services:smsProvider': z.string().min(1),
  'services:storageProvider': z.string().min(1),
  'services:paymentProvider': z.string().min(1),
  'features:rewardsEnabled': z.boolean(),
};

export function getConfigSchema(module: string, key: string): z.ZodTypeAny {
  return schemas[`${module}:${key}`] ?? z.any();
}

export interface ValidationResult {
  valid: boolean;
  errors?: { path: string; message: string }[];
}

export function validateConfigValue(
  module: string,
  key: string,
  value: unknown
): ValidationResult {
  const schema = getConfigSchema(module, key);
  const result = schema.safeParse(value);
  if (result.success) return { valid: true };
  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  };
}
