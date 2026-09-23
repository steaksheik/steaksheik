import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { decryptCredentials } from '@/lib/security/crypto';
import { logger } from '@/lib/logger';

/**
 * This is a fully managed platform — a client rotates or sets up their own
 * Stripe keys from Admin -> Platform Services -> Payments, the same as
 * Email/SMS/Storage already work. Nobody should ever need to touch a Vercel
 * environment variable to get payments working.
 *
 * STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET env vars are kept ONLY as a
 * fallback for local development before the admin form has ever been used —
 * never required in production.
 */
async function loadPaymentCredentials(tenantId?: string): Promise<Record<string, unknown> | null> {
  try {
    const svc = await prisma.platformService.findFirst({
      where: {
        serviceType: 'PAYMENT' as never,
        isEnabled: true,
        ...(tenantId ? { tenantId } : {}),
      },
    });
    if (!svc) return null;
    return decryptCredentials((svc.credentials ?? {}) as Record<string, unknown>);
  } catch (err) {
    logger.warn('[stripe] Failed to load Payment credentials from Platform Services', {
      error: (err as Error).message,
    });
    return null;
  }
}

/** The client's configured Stripe secret key (Admin -> Platform Services -> Payments), or the env var fallback. */
export async function getStripeSecretKey(tenantId?: string): Promise<string | null> {
  const creds = await loadPaymentCredentials(tenantId);
  const key = creds?.secretKey as string | undefined;
  return key || process.env.STRIPE_SECRET_KEY || null;
}

/** The client's configured Stripe webhook signing secret, or the env var fallback. */
export async function getStripeWebhookSecret(tenantId?: string): Promise<string | null> {
  const creds = await loadPaymentCredentials(tenantId);
  const secret = creds?.webhookSecret as string | undefined;
  return secret || process.env.STRIPE_WEBHOOK_SECRET || null;
}

/** A real, ready-to-use Stripe client built from the client's own configured key. Throws a clear error if Payments hasn't been set up yet. */
export async function getStripeClient(tenantId?: string): Promise<Stripe> {
  const key = await getStripeSecretKey(tenantId);
  if (!key) {
    throw new Error('Stripe is not configured yet — set it up in Admin -> Platform Services -> Payments.');
  }
  return new Stripe(key, { typescript: true });
}
