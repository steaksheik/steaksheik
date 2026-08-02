import { getDefaultTenant, getRewardsEnabled } from '@/lib/storefront';
import AccountLayoutClient from './account-layout-client';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getDefaultTenant();
  const rewardsEnabled = await getRewardsEnabled(tenant.id);

  return <AccountLayoutClient rewardsEnabled={rewardsEnabled}>{children}</AccountLayoutClient>;
}
