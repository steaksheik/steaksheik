import { prisma } from '@/lib/db';

/** Tier thresholds based on lifetime points */
const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 1500,
  PLATINUM: 5000,
} as const;

/** Points earned per £1 spent */
const POINTS_PER_POUND = 10;

type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export function calculateTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (lifetimePoints >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (lifetimePoints >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

export function getTierBenefits(tier: LoyaltyTier) {
  const benefits: Record<LoyaltyTier, { multiplier: number; perks: string[] }> = {
    BRONZE: { multiplier: 1.0, perks: ['Earn 10 points per £1 spent', 'Birthday reward'] },
    SILVER: { multiplier: 1.25, perks: ['1.25x points multiplier', 'Birthday reward', 'Early access to specials'] },
    GOLD: { multiplier: 1.5, perks: ['1.5x points multiplier', 'Birthday reward', 'Early access', 'Free delivery on all orders'] },
    PLATINUM: { multiplier: 2.0, perks: ['2x points multiplier', 'Birthday reward', 'Early access', 'Free delivery', 'Exclusive tasting events'] },
  };
  return benefits[tier];
}

export async function getOrCreateLoyaltyAccount(customerId: string, tenantId: string) {
  let account = await prisma.loyaltyAccount.findUnique({
    where: { customerId },
  });
  if (!account) {
    account = await prisma.loyaltyAccount.create({
      data: { customerId, tenantId },
    });
  }
  return account;
}

export async function getLoyaltyDashboard(customerId: string, tenantId: string) {
  const account = await getOrCreateLoyaltyAccount(customerId, tenantId);
  const tierBenefits = getTierBenefits(account.tier as LoyaltyTier);
  const nextTier = getNextTier(account.tier as LoyaltyTier);
  const pointsToNextTier = nextTier
    ? TIER_THRESHOLDS[nextTier] - account.lifetimePoints
    : null;

  const recentTransactions = await prisma.loyaltyTransaction.findMany({
    where: { loyaltyAccountId: account.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    pointsBalance: account.pointsBalance,
    lifetimePoints: account.lifetimePoints,
    tier: account.tier,
    tierBenefits,
    nextTier,
    pointsToNextTier: pointsToNextTier && pointsToNextTier > 0 ? pointsToNextTier : null,
    transactions: recentTransactions,
    tierThresholds: TIER_THRESHOLDS,
  };
}

function getNextTier(current: LoyaltyTier): LoyaltyTier | null {
  const order: LoyaltyTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

/** Award points for a completed order */
export async function awardOrderPoints(
  customerId: string,
  tenantId: string,
  orderId: string,
  orderTotal: number,
) {
  const account = await getOrCreateLoyaltyAccount(customerId, tenantId);
  const tierBenefits = getTierBenefits(account.tier as LoyaltyTier);
  const basePoints = Math.floor(orderTotal * POINTS_PER_POUND);
  const earnedPoints = Math.floor(basePoints * tierBenefits.multiplier);

  if (earnedPoints <= 0) return account;

  // Check idempotency — don't double-award for the same order
  const existing = await prisma.loyaltyTransaction.findFirst({
    where: { loyaltyAccountId: account.id, orderId, type: 'EARN' },
  });
  if (existing) return account;

  const newLifetime = account.lifetimePoints + earnedPoints;
  const newTier = calculateTier(newLifetime);

  const updated = await prisma.loyaltyAccount.update({
    where: { id: account.id },
    data: {
      pointsBalance: { increment: earnedPoints },
      lifetimePoints: newLifetime,
      tier: newTier,
      tierUpdatedAt: newTier !== account.tier ? new Date() : account.tierUpdatedAt,
    },
  });

  await prisma.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: account.id,
      points: earnedPoints,
      type: 'EARN',
      description: `Earned ${earnedPoints} points from order`,
      orderId,
    },
  });

  return updated;
}
