
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { parse } from 'csv/sync';
import { withRoute } from '@/lib/api/route';
import { ok, fail } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit/service';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 2000;

const importSchema = z.object({
  csv: z.string().min(1, 'CSV content is required'),
  emailConsent: z.boolean().default(false),
  smsConsent: z.boolean().default(false),
  consentNote: z.string().trim().min(1, 'Please note where this list came from and how consent was obtained').max(500),
});

interface CsvRow {
  firstName?: string;
  firstname?: string;
  lastName?: string;
  lastname?: string;
  name?: string;
  email?: string;
  phone?: string;
  [key: string]: string | undefined;
}

function normalizeEmail(v?: string): string | undefined {
  const t = v?.trim().toLowerCase();
  return t ? t : undefined;
}

function normalizePhone(v?: string): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/**
 * POST /api/v1/admin/customers/import — bulk-add contacts from a CSV
 * (columns: firstName/name, lastName, email, phone) for people who already
 * consented offline. One confirmation covers the whole batch — the
 * consentNote is required so there's a record of where the list came from.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'ordering:customers:write');
  const body = importSchema.parse(await req.json().catch(() => ({})));

  if (!body.emailConsent && !body.smsConsent) {
    return fail('VALIDATION_ERROR', 'Select at least one channel this list consented to (email and/or SMS)', { status: 400 });
  }

  let rows: CsvRow[];
  try {
    rows = parse(body.csv, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];
  } catch (err) {
    return fail('INVALID_CSV', `Could not parse CSV: ${(err as Error).message}`, { status: 400 });
  }
  if (rows.length === 0) return fail('EMPTY_CSV', 'No rows found in the CSV', { status: 400 });
  if (rows.length > MAX_ROWS) {
    return fail('TOO_MANY_ROWS', `CSV has ${rows.length} rows — please split into batches of ${MAX_ROWS} or fewer`, { status: 400 });
  }

  let imported = 0;
  let updated = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = body.emailConsent ? normalizeEmail(r.email) : undefined;
    const phone = body.smsConsent ? normalizePhone(r.phone) : undefined;
    const firstName = (r.firstName || r.firstname || r.name || '').trim() || undefined;
    const lastName = (r.lastName || r.lastname || '').trim() || undefined;

    if (!email && !phone) {
      skipped.push({ row: i + 2, reason: 'No usable email/phone for the selected consent channel(s)' });
      continue;
    }

    const existing = email
      ? await prisma.customer.findFirst({ where: { tenantId: ctx.tenantId, email } })
      : await prisma.customer.findFirst({ where: { tenantId: ctx.tenantId, email: null, phone } });

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          firstName: existing.firstName || firstName || null,
          lastName: existing.lastName || lastName || null,
          phone: existing.phone || phone || null,
          marketingEmailConsent: existing.marketingEmailConsent || Boolean(email),
          marketingSmsConsent: existing.marketingSmsConsent || Boolean(phone),
          marketingConsentUpdatedAt: new Date(),
          contactSource: existing.contactSource === 'campaign_oneoff' ? 'csv_import' : existing.contactSource,
        },
      });
      updated++;
    } else {
      await prisma.customer.create({
        data: {
          tenantId: ctx.tenantId,
          email: email ?? null,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          phone: phone ?? null,
          contactSource: 'csv_import',
          marketingEmailConsent: Boolean(email),
          marketingSmsConsent: Boolean(phone),
          marketingConsentUpdatedAt: new Date(),
        },
      });
      imported++;
    }
  }

  await auditLog({
    tenantId: ctx.tenantId,
    userId: ctx.session.userId,
    action: 'customer.bulk_import',
    resource: 'Customer',
    after: { imported, updated, skipped: skipped.length, emailConsent: body.emailConsent, smsConsent: body.smsConsent },
    metadata: { source: 'csv_import', consentNote: body.consentNote, totalRows: rows.length },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ imported, updated, skipped, totalRows: rows.length });
});
