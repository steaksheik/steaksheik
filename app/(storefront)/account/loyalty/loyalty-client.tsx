'use client';

import { useState, useEffect } from 'react';
import { Loader2, Award, TrendingUp, Star, Gift, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const ACCENT = '#c9a96e';

interface Transaction {
  id: string;
  points: number;
  type: string;
  description: string;
  createdAt: string;
}

interface LoyaltyData {
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
  tierBenefits: { multiplier: number; perks: string[] };
  nextTier: string | null;
  pointsToNextTier: number | null;
  transactions: Transaction[];
  tierThresholds: Record<string, number>;
}

const TIER_COLOURS: Record<string, string> = {
  BRONZE: 'text-orange-400',
  SILVER: 'text-gray-300',
  GOLD: 'text-yellow-400',
  PLATINUM: 'text-cyan-300',
};

const TIER_BG: Record<string, string> = {
  BRONZE: 'from-orange-900/30 to-orange-800/10 border-orange-500/20',
  SILVER: 'from-gray-700/30 to-gray-600/10 border-gray-400/20',
  GOLD: 'from-yellow-900/30 to-yellow-800/10 border-yellow-500/20',
  PLATINUM: 'from-cyan-900/30 to-cyan-800/10 border-cyan-400/20',
};

export default function LoyaltyClient() {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/v1/customers/loyalty');
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: ACCENT }} /></div>;
  }

  if (!data) {
    return <div className="text-center py-16 text-neutral-400">Unable to load rewards data</div>;
  }

  const tierProgress = data.nextTier && data.pointsToNextTier
    ? Math.min(100, ((data.tierThresholds[data.nextTier] - data.pointsToNextTier) / data.tierThresholds[data.nextTier]) * 100)
    : 100;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-xl tracking-wide mb-1">REWARDS</h2>
        <p className="text-sm text-neutral-400">Earn points with every order and unlock exclusive benefits</p>
      </div>

      {/* Tier Card */}
      <div className={`bg-gradient-to-br ${TIER_BG[data.tier] || TIER_BG.BRONZE} border rounded-2xl p-6 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className={`h-8 w-8 ${TIER_COLOURS[data.tier] || 'text-orange-400'}`} />
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-400">Your Tier</p>
              <p className={`font-heading text-2xl tracking-wide ${TIER_COLOURS[data.tier] || 'text-orange-400'}`}>
                {data.tier}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Points Balance</p>
            <p className="text-2xl font-bold text-white">{data.pointsBalance.toLocaleString()}</p>
          </div>
        </div>

        {/* Progress to next tier */}
        {data.nextTier && data.pointsToNextTier && (
          <div>
            <div className="flex justify-between text-xs text-neutral-400 mb-1.5">
              <span>{data.tier}</span>
              <span>{data.pointsToNextTier.toLocaleString()} pts to {data.nextTier}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${tierProgress}%`, backgroundColor: ACCENT }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-4 w-4 text-[#c9a96e]" />
            <span className="text-xs uppercase tracking-wider text-neutral-400">Points Balance</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.pointsBalance.toLocaleString()}</p>
        </div>
        <div className="border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-[#c9a96e]" />
            <span className="text-xs uppercase tracking-wider text-neutral-400">Lifetime Points</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.lifetimePoints.toLocaleString()}</p>
        </div>
        <div className="border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-4 w-4 text-[#c9a96e]" />
            <span className="text-xs uppercase tracking-wider text-neutral-400">Points Multiplier</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.tierBenefits.multiplier}x</p>
        </div>
      </div>

      {/* Benefits */}
      <div>
        <h3 className="font-heading text-lg tracking-wide mb-3">YOUR BENEFITS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.tierBenefits.perks.map((perk, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-neutral-300 py-2 px-3 rounded-lg bg-white/[0.02]">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
              {perk}
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h3 className="font-heading text-lg tracking-wide mb-3">POINTS HISTORY</h3>
        {data.transactions.length === 0 ? (
          <p className="text-sm text-neutral-400 py-8 text-center">No transactions yet. Start ordering to earn points!</p>
        ) : (
          <div className="divide-y divide-white/5">
            {data.transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {tx.points > 0
                    ? <ArrowUpRight className="h-4 w-4 text-green-400" />
                    : <ArrowDownRight className="h-4 w-4 text-red-400" />}
                  <div>
                    <p className="text-sm text-white">{tx.description}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${tx.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
