import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) console.warn('[stripe] STRIPE_SECRET_KEY not set — payments will fail');

export const stripe = new Stripe(key || 'sk_test_placeholder', {
  typescript: true,
});
