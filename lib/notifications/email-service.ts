import { logger } from '@/lib/logger';

// ── Types ───────────────────────────────────────────────
interface SendEmailOpts {
  notificationId: string;
  subject: string;
  body: string;
  recipientEmail?: string;
  replyTo?: string;
}

const ADMIN_EMAIL = 'steaksheikh4@gmail.com';

/**
 * Attempt to send through the admin-configured email provider
 * (Amazon SES / SMTP / Resend), selected in /admin/services.
 * Returns true on success. Any failure returns false so the caller
 * falls back to the Abacus notification API and then console logging —
 * email must never block order processing.
 */
async function trySendViaConfiguredProvider(
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<boolean> {
  try {
    const { prisma } = await import('@/lib/db');
    const svc = await prisma.platformService.findFirst({
      where: { serviceType: 'EMAIL' as never, isEnabled: true },
    });
    if (!svc) return false;

    const { decryptCredentials } = await import('@/lib/security/crypto');
    const { pluginRegistry } = await import('@/lib/plugins/registry');

    const creds = decryptCredentials((svc.credentials ?? {}) as Record<string, unknown>);
    const config = (svc.config ?? {}) as Record<string, unknown>;
    await pluginRegistry.reconfigure('EMAIL', { ...config, ...creds });
    const adapter = pluginRegistry.get('EMAIL') as unknown as {
      isFallback: boolean;
      send: (p: { to: string; subject: string; html: string; replyTo?: string }) => Promise<{ success: boolean }>;
    };
    // If the primary provider isn't actually usable the registry returns the
    // console fallback — skip it here so the Abacus API path can take over.
    if (adapter.isFallback) return false;
    const result = await adapter.send({ to, subject, html, replyTo });
    if (result.success) {
      logger.info('[notifications] Email sent via configured provider', {
        provider: config.provider ?? 'ses',
        subject,
      });
      return true;
    }
    return false;
  } catch (err) {
    logger.warn('[notifications] Configured provider send failed, falling back', {
      error: (err as Error).message,
    });
    return false;
  }
}

function getSenderInfo() {
  const appUrl = process.env.NEXTAUTH_URL || '';
  let hostname = 'darkkitchen.abacusai.app';
  try { hostname = new URL(appUrl).hostname; } catch {}
  return {
    senderEmail: `noreply@${hostname}`,
    senderAlias: 'The Steak Sheikh',
  };
}

/**
 * Send a notification email via Abacus API.
 * Fails silently — order processing should never be blocked by email failures.
 */
export async function sendNotificationEmail(opts: SendEmailOpts): Promise<boolean> {
  const { notificationId, subject, body, recipientEmail, replyTo } = opts;
  const to = recipientEmail ?? ADMIN_EMAIL;

  // 1) Prefer the admin-configured provider (SES / SMTP / Resend) when enabled.
  if (await trySendViaConfiguredProvider(to, subject, body, replyTo)) {
    return true;
  }

  // 2) Fall back to the Abacus notification API (if credentials are present).
  const apiKey = process.env.ABACUSAI_API_KEY;
  const appId = process.env.WEB_APP_ID;

  if (!apiKey || !appId) {
    logger.warn('[notifications] No configured email provider and missing ABACUSAI_API_KEY/WEB_APP_ID, skipping email');
    return false;
  }

  const { senderEmail, senderAlias } = getSenderInfo();

  try {
    const res = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: apiKey,
        app_id: appId,
        notification_id: notificationId,
        subject,
        body,
        is_html: true,
        recipient_email: recipientEmail ?? ADMIN_EMAIL,
        reply_to: replyTo,
        sender_email: senderEmail,
        sender_alias: senderAlias,
      }),
    });

    const result = await res.json();
    if (!result.success) {
      if (result.notification_disabled) {
        logger.info('[notifications] Notification disabled by user', { notificationId });
        return true;
      }
      logger.warn('[notifications] Failed to send email', { notificationId, message: result.message });
      return false;
    }

    logger.info('[notifications] Email sent', { notificationId, subject });
    return true;
  } catch (err) {
    logger.error('[notifications] Email send error', { notificationId, error: (err as Error).message });
    return false;
  }
}

// ── Email Templates ──────────────────────────────────────

export function emailWrapper(content: string): string {
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #0a0a0a; padding: 24px 32px; text-align: center;">
        <h1 style="color: #c9a96e; margin: 0; font-size: 24px; letter-spacing: 2px;">THE STEAK SHEIKH</h1>
        <p style="color: #888; margin: 4px 0 0; font-size: 12px;">Made with love.</p>
      </div>
      <div style="padding: 32px;">
        ${content}
      </div>
      <div style="background: #f9f9f9; padding: 20px 32px; text-align: center; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 11px; margin: 0;">The Steak Sheikh &mdash; Made with love.</p>
      </div>
    </div>
  `;
}

function fmtPrice(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

// ── Order Confirmed -> Admin notification ─────────────────
export async function sendNewOrderAdminAlert(order: {
  orderNumber: string;
  total: number;
  type: string;
  items: { productName: string; quantity: number; totalPrice: number }[];
  customerName?: string;
  customerEmail?: string;
}) {
  const itemsHtml = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${i.productName}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; text-align: center;">x${i.quantity}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">${fmtPrice(Number(i.totalPrice))}</td>
        </tr>`,
    )
    .join('');

  const content = `
    <h2 style="color: #0a0a0a; margin: 0 0 16px;">New Order Received</h2>
    <div style="background: #f8f6f1; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 4px 0;"><strong>Order:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0;"><strong>Type:</strong> ${order.type === 'DELIVERY' ? 'Delivery' : 'Collection'}</p>
      <p style="margin: 4px 0;"><strong>Customer:</strong> ${order.customerName ?? 'Guest'} ${order.customerEmail ? `(${order.customerEmail})` : ''}</p>
      <p style="margin: 4px 0;"><strong>Total:</strong> <span style="color: #c9a96e; font-weight: bold; font-size: 18px;">${fmtPrice(Number(order.total))}</span></p>
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 2px solid #0a0a0a;">
          <th style="text-align: left; padding: 8px 0;">Item</th>
          <th style="text-align: center; padding: 8px 0;">Qty</th>
          <th style="text-align: right; padding: 8px 0;">Price</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  `;

  return sendNotificationEmail({
    notificationId: process.env.NOTIF_ID_NEW_ORDER_RECEIVED || '',
    subject: `New Order ${order.orderNumber} - ${fmtPrice(Number(order.total))}`,
    body: emailWrapper(content),
    recipientEmail: ADMIN_EMAIL,
    replyTo: order.customerEmail,
  });
}

// ── Order Status Update -> Customer notification ──────────
const STATUS_MESSAGES: Record<string, { title: string; message: string }> = {
  CONFIRMED: {
    title: 'Order Confirmed',
    message: 'Your order has been confirmed and will be prepared shortly.',
  },
  PREPARING: {
    title: 'Being Prepared',
    message: 'Our chefs are now preparing your order with care.',
  },
  READY: {
    title: 'Ready',
    message: 'Your order is ready! It will be dispatched shortly or is ready for collection.',
  },
  DISPATCHED: {
    title: 'On Its Way',
    message: 'Your order has been dispatched and is on its way to you.',
  },
  DELIVERED: {
    title: 'Delivered',
    message: 'Your order has been delivered. Enjoy your meal!',
  },
};

export async function sendOrderStatusUpdate(order: {
  orderNumber: string;
  status: string;
  total: number;
  customerEmail: string;
  customerName?: string;
}) {
  const info = STATUS_MESSAGES[order.status];
  if (!info) return false;

  const content = `
    <h2 style="color: #0a0a0a; margin: 0 0 8px;">Order ${info.title}</h2>
    <p style="color: #666; margin: 0 0 20px;">Hi ${order.customerName ?? 'there'},</p>
    <p style="margin: 0 0 20px;">${info.message}</p>
    <div style="background: #f8f6f1; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 4px 0;"><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #c9a96e; font-weight: bold;">${info.title.toUpperCase()}</span></p>
      <p style="margin: 4px 0;"><strong>Total:</strong> ${fmtPrice(Number(order.total))}</p>
    </div>
    <p style="color: #666; font-size: 13px;">Thank you for choosing The Steak Sheikh.</p>
  `;

  return sendNotificationEmail({
    notificationId: process.env.NOTIF_ID_ORDER_STATUS_UPDATE || '',
    subject: `Order ${order.orderNumber} - ${info.title}`,
    body: emailWrapper(content),
    recipientEmail: order.customerEmail,
  });
}

// ── Order Cancelled -> Customer notification ──────────────
export async function sendOrderCancelledEmail(order: {
  orderNumber: string;
  total: number;
  customerEmail: string;
  customerName?: string;
  cancellationReason?: string;
}) {
  const content = `
    <h2 style="color: #0a0a0a; margin: 0 0 8px;">Order Cancelled</h2>
    <p style="color: #666; margin: 0 0 20px;">Hi ${order.customerName ?? 'there'},</p>
    <p style="margin: 0 0 20px;">We're sorry to inform you that your order has been cancelled.</p>
    <div style="background: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 20px;">
      <p style="margin: 4px 0;"><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0;"><strong>Total:</strong> ${fmtPrice(Number(order.total))}</p>
      ${order.cancellationReason ? `<p style="margin: 4px 0;"><strong>Reason:</strong> ${order.cancellationReason}</p>` : ''}
    </div>
    <p style="color: #666; font-size: 13px;">If you have any questions, please don't hesitate to contact us. A refund will be processed if applicable.</p>
  `;

  return sendNotificationEmail({
    notificationId: process.env.NOTIF_ID_ORDER_CANCELLED || '',
    subject: `Order ${order.orderNumber} - Cancelled`,
    body: emailWrapper(content),
    recipientEmail: order.customerEmail,
  });
}

// ── Order Refunded -> Customer notification ──────────────
export async function sendOrderRefundedEmail(order: {
  orderNumber: string;
  refundAmount: number;
  orderTotal: number;
  customerEmail: string;
  customerName?: string;
}) {
  const isPartial = order.refundAmount < order.orderTotal;
  const content = `
    <h2 style="color: #0a0a0a; margin: 0 0 8px;">Refund Processed</h2>
    <p style="color: #666; margin: 0 0 20px;">Hi ${order.customerName ?? 'there'},</p>
    <p style="margin: 0 0 20px;">We've processed a${isPartial ? ' partial' : ''} refund for your order.</p>
    <div style="background: #f8f6f1; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 4px 0;"><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0;"><strong>Refunded Amount:</strong> ${fmtPrice(order.refundAmount)}</p>
    </div>
    <p style="color: #666; font-size: 13px;">Refunds typically appear on your original payment method within 5-10 business days.</p>
  `;

  return sendNotificationEmail({
    notificationId: process.env.NOTIF_ID_ORDER_REFUNDED || '',
    subject: `Order ${order.orderNumber} - Refund Processed`,
    body: emailWrapper(content),
    recipientEmail: order.customerEmail,
  });
}

// ── Welcome Email -> Customer ─────────────────────────────
export async function sendWelcomeEmail(customer: {
  email: string;
  firstName: string;
}) {
  const content = `
    <h2 style="color: #0a0a0a; margin: 0 0 8px;">Welcome to The Steak Sheikh</h2>
    <p style="color: #666; margin: 0 0 20px;">Hi ${customer.firstName},</p>
    <p style="margin: 0 0 20px;">Thank you for creating an account with us. You're now part of our exclusive community of steak enthusiasts.</p>
    <div style="background: #f8f6f1; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="color: #c9a96e; margin: 0 0 12px;">Your Benefits</h3>
      <ul style="margin: 0; padding: 0 0 0 20px; color: #444;">
        <li style="margin-bottom: 8px;">Earn loyalty points on every order</li>
        <li style="margin-bottom: 8px;">Track your orders in real-time</li>
        <li style="margin-bottom: 8px;">Save your delivery addresses</li>
        <li style="margin-bottom: 8px;">Unlock tier rewards: Bronze, Silver, Gold, Platinum</li>
      </ul>
    </div>
    <p style="margin: 0 0 20px;">Ready to order? Browse our premium cuts and experience perfection.</p>
    <p style="color: #666; font-size: 13px;">Regards,<br/>The Steak Sheikh Team</p>
  `;

  return sendNotificationEmail({
    notificationId: process.env.NOTIF_ID_WELCOME_EMAIL || '',
    subject: 'Welcome to The Steak Sheikh - Made with Love',
    body: emailWrapper(content),
    recipientEmail: customer.email,
  });
}

// ── Daily Summary -> Admin ────────────────────────────────
export async function sendDailySummary(stats: {
  ordersToday: number;
  revenueToday: number;
  newCustomers: number;
  topProduct: string;
  date: string;
}) {
  const content = `
    <h2 style="color: #0a0a0a; margin: 0 0 16px;">Daily Summary - ${stats.date}</h2>
    <table style="width: 100%; margin-bottom: 20px;">
      <tr>
        <td style="width: 50%; background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">Revenue</p>
          <p style="color: #0a0a0a; font-size: 24px; font-weight: bold; margin: 4px 0 0;">${fmtPrice(stats.revenueToday)}</p>
        </td>
        <td style="width: 8px;"></td>
        <td style="width: 50%; background: #eff6ff; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">Orders</p>
          <p style="color: #0a0a0a; font-size: 24px; font-weight: bold; margin: 4px 0 0;">${stats.ordersToday}</p>
        </td>
      </tr>
    </table>
    <div style="background: #f8f6f1; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 4px 0;"><strong>New Customers:</strong> ${stats.newCustomers}</p>
      <p style="margin: 4px 0;"><strong>Top Product:</strong> ${stats.topProduct || 'N/A'}</p>
    </div>
  `;

  return sendNotificationEmail({
    notificationId: process.env.NOTIF_ID_DAILY_SALES_SUMMARY || '',
    subject: `Daily Summary - ${fmtPrice(stats.revenueToday)} revenue, ${stats.ordersToday} orders`,
    body: emailWrapper(content),
    recipientEmail: ADMIN_EMAIL,
  });
}
