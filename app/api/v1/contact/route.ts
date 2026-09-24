import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { publicTenant, getClientIp, requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { sendContactMessageAlert } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().min(1).max(5000),
  turnstileToken: z.string().optional(),
});

/**
 * POST /api/v1/contact — public contact form.
 *
 * Deliberately does NOT create or touch a Customer record: an enquiry is not
 * a signup, and saving one must never imply marketing consent.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const tenantId = await publicTenant(req);
  const body = submitSchema.parse(await req.json().catch(() => ({})));

  const bot = await verifyTurnstile({
    token: body.turnstileToken,
    action: 'contact',
    remoteIp: getClientIp(req),
    host: req.headers.get('host'),
  });
  if (!bot.ok) {
    return fail('BOT_CHECK_FAILED', 'Could not verify you are human — please refresh and try again', { status: 403 });
  }

  const created = await prisma.contactMessage.create({
    data: {
      tenantId,
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      subject: body.subject || null,
      message: body.message,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
    },
  });

  // Fire-and-forget — a mail failure must never lose the enquiry, which is
  // already safely in the database and visible in the admin either way.
  sendContactMessageAlert({
    name: created.name,
    email: created.email,
    phone: created.phone,
    subject: created.subject,
    message: created.message,
  }).catch(() => {});

  return ok({ received: true }, { status: 201 });
}, { rateLimit: 'ipUnauth' });

/** GET /api/v1/contact — admin: list messages, newest first. */
export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'support:messages:read');
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200);

  const where: Record<string, unknown> = { tenantId: ctx.tenantId };
  if (status) where.status = status;

  const [messages, total, unread] = await Promise.all([
    prisma.contactMessage.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.contactMessage.count({ where: where as never }),
    prisma.contactMessage.count({ where: { tenantId: ctx.tenantId, status: 'NEW' } }),
  ]);

  return ok({ messages, total, unread });
});
