import crypto from 'crypto';
import { logger } from '@/lib/logger';

/**
 * AES-256-GCM encryption for platform-service credentials at rest.
 * Key sourced from CREDENTIALS_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * Format of ciphertext: base64(iv).base64(authTag).base64(cipherText)
 */

const ALGO = 'aes-256-gcm';

function getKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    logger.warn('CREDENTIALS_ENCRYPTION_KEY not set — credentials stored without encryption');
    return null;
  }
  try {
    const key = Buffer.from(raw, 'hex');
    if (key.length !== 32) {
      logger.warn('CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

const PREFIX = 'enc:v1:';

export function encrypt(plainText: string): string {
  const key = getKey();
  if (!key) return plainText;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return (
      PREFIX +
      [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.')
    );
  } catch (err) {
    logger.error('Encryption failed', { error: String(err) });
    return plainText;
  }
}

export function decrypt(cipherText: string): string {
  const key = getKey();
  if (!key || !cipherText?.startsWith?.(PREFIX)) return cipherText;
  try {
    const body = cipherText.slice(PREFIX.length);
    const [ivB64, tagB64, dataB64] = body.split('.');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    logger.error('Decryption failed', { error: String(err) });
    return cipherText;
  }
}

/** Encrypt an object of credentials — each string value encrypted individually. */
export function encryptCredentials(creds: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(creds ?? {})) {
    out[k] = typeof v === 'string' ? encrypt(v) : v;
  }
  return out;
}

export function decryptCredentials(creds: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(creds ?? {})) {
    out[k] = typeof v === 'string' ? decrypt(v) : v;
  }
  return out;
}

/** Mask a secret for safe display, e.g. sk_live_****1234 */
export function maskSecret(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  const decrypted = value.startsWith(PREFIX) ? decrypt(value) : value;
  if (decrypted.length <= 8) return '****';
  return `${decrypted.slice(0, 4)}****${decrypted.slice(-4)}`;
}

/** Mask all values in a credentials object for API responses. */
export function maskCredentials(creds: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds ?? {})) {
    out[k] = maskSecret(v);
  }
  return out;
}

/** HMAC-SHA256 signature (used for cursors & signature verification). */
export function hmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function randomToken(): string {
  return crypto.randomUUID();
}
