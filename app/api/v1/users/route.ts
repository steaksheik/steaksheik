import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { auditLog } from '@/lib/audit/service';
import { parsePagination } from '@/lib/api/pagination';
import { publishEvent } from '@/lib/events/bus';
import { Prisma } from '@prisma/client';
import { randomToken } from '@/lib/security/crypto';
import { getSiteUrl } from '@/lib/seo';
import { sendAdminInviteEmail } from '@/lib/notifications/email-service';

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const dynamic = 'force-dynamic';

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'identity:users:read');
  const { searchParams } = new URL(req.url);
  const { limit } = parsePagination(searchParams);
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
  const take = limit;
  const skip = (page - 1) * take;
  const search = searchParams.get('search')?.trim();
  const where: Prisma.UserWhereInput = {
    tenantId: ctx.tenantId,
    ...(search
      ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, firstName: true, lastName: true, status: true, emailVerified: true, createdAt: true, userRoles: { include: { role: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  const data = (users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    status: u.status,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
    roles: (u.userRoles ?? []).map((ur) => ({ id: ur.role?.id, name: ur.role?.name, displayName: ur.role?.displayName })),
  }));
  return ok({ users: data }, { pagination: { cursor: null, limit: take, hasMore: skip + take < total, total } });
});

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  roleIds: z.array(z.string()).optional(),
});

/**
 * Creating a user never accepts a password directly — an invite email is
 * sent instead, with a link to set it themselves. The account starts
 * PENDING_VERIFICATION with an unusable placeholder hash (a random UUID,
 * never revealed) so it genuinely cannot be logged into until the invite is
 * accepted; the same token mechanism doubles as "resend invite" if reused
 * via the forgot-password flow for a still-pending user.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requirePermission(req, 'identity:users:write');
  const body = createSchema.parse(await req.json().catch(() => ({})));
  const placeholderHash = await hashPassword(randomToken());
  const resetToken = randomToken();
  const resetTokenExpiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

  const user = await prisma.user.create({
    data: {
      tenantId: ctx.tenantId,
      email: body.email.toLowerCase(),
      passwordHash: placeholderHash,
      firstName: body.firstName,
      lastName: body.lastName,
      status: 'PENDING_VERIFICATION',
      createdBy: ctx.session.userId,
      resetToken,
      resetTokenExpiresAt,
      userRoles: body.roleIds?.length
        ? { create: body.roleIds.map((roleId) => ({ roleId })) }
        : undefined,
    },
    select: { id: true, email: true, firstName: true, lastName: true, status: true },
  });

  sendAdminInviteEmail({
    email: user.email,
    firstName: user.firstName,
    resetUrl: `${getSiteUrl()}/admin/reset-password?token=${resetToken}`,
  }).catch(() => {});

  await auditLog({ tenantId: ctx.tenantId, userId: ctx.session.userId, action: 'user.invited', resource: 'User', resourceId: user.id, after: { email: user.email }, ipAddress: ctx.ip, userAgent: ctx.userAgent });
  await publishEvent({ tenantId: ctx.tenantId, type: 'identity.user.created', aggregateId: user.id, aggregateType: 'User', payload: { email: user.email }, userId: ctx.session.userId });
  return ok({ user }, { status: 201 });
});
