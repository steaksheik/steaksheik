import { getDefaultTenant, getRewardsEnabled } from '@/lib/storefront';
import LoyaltyClient from './loyalty-client';

export const dynamic = 'force-dynamic';

export default async function LoyaltyPage() {
  const tenant = await getDefaultTenant();
  const rewardsEnabled = await getRewardsEnabled(tenant.id);

  if (!rewardsEnabled) {
    return (
      <div className="text-center py-16 text-neutral-400">
        <h2 className="font-heading text-xl tracking-wide mb-2 text-white">REWARDS</h2>
        <p className="text-sm">Rewards isn&apos;t currently available.</p>
      </div>
    );
  }

  return <LoyaltyClient />;
}
