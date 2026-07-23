'use client';

import { useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import { useCart } from '@/lib/cart-context';

interface Variant {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

interface Modifier {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: Modifier[];
}

function formatPrice(price: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(price);
}

export function ProductConfigurator({
  productId,
  variants,
  modifierGroups,
  basePrice,
  accent,
  currency = 'GBP',
}: {
  productId: string;
  variants: Variant[];
  modifierGroups: ModifierGroup[];
  basePrice: number;
  accent: string;
  currency?: string;
}) {
  const { addItem, loading: cartLoading } = useCart();
  const defaultVariant = variants.find(v => v.isDefault) ?? variants[0];
  const [selectedVariant, setSelectedVariant] = useState<string | null>(defaultVariant?.id ?? null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    modifierGroups.forEach(g => {
      const defaults = g.modifiers.filter(m => m.isDefault).map(m => m.id);
      init[g.id] = new Set(defaults);
    });
    return init;
  });

  const toggleModifier = (groupId: string, modifierId: string, maxSelect: number) => {
    setSelectedModifiers(prev => {
      const current = new Set(prev[groupId] ?? []);
      if (current.has(modifierId)) {
        current.delete(modifierId);
      } else {
        if (maxSelect === 1) {
          current.clear();
        } else if (current.size >= maxSelect) {
          return prev;
        }
        current.add(modifierId);
      }
      return { ...prev, [groupId]: current };
    });
  };

  const totalPrice = useMemo(() => {
    let price = selectedVariant
      ? (variants.find(v => v.id === selectedVariant)?.price ?? basePrice)
      : basePrice;

    modifierGroups.forEach(g => {
      const selected = selectedModifiers[g.id] ?? new Set();
      g.modifiers.forEach(m => {
        if (selected.has(m.id)) price += m.priceAdjustment;
      });
    });

    return price;
  }, [selectedVariant, selectedModifiers, variants, modifierGroups, basePrice]);

  if (variants.length === 0 && modifierGroups.length === 0) return null;

  return (
    <div className="mt-8 space-y-8">
      {/* Variants */}
      {variants.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Select Preparation</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v.id)}
                className="relative rounded-lg px-4 py-3 text-left text-sm transition-all border"
                style={
                  selectedVariant === v.id
                    ? { borderColor: accent, backgroundColor: `${accent}15` }
                    : { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }
                }
              >
                <span className="font-medium">{v.name}</span>
                {selectedVariant === v.id && (
                  <Check className="absolute top-2 right-2 h-3.5 w-3.5" style={{ color: accent }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modifier groups */}
      {modifierGroups.map((group) => (
        <div key={group.id}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">{group.name}</h3>
            {group.isRequired && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">Required</span>}
            <span className="text-[10px] text-white/30">
              {group.maxSelect === 1 ? 'Choose one' : `Choose up to ${group.maxSelect}`}
            </span>
          </div>
          {group.description && <p className="text-xs text-white/30 mb-3">{group.description}</p>}
          <div className="space-y-2">
            {group.modifiers.map((mod) => {
              const isSelected = selectedModifiers[group.id]?.has(mod.id) ?? false;
              return (
                <button
                  key={mod.id}
                  onClick={() => toggleModifier(group.id, mod.id, group.maxSelect)}
                  className="w-full flex items-center justify-between rounded-lg px-4 py-3 text-sm transition-all border"
                  style={
                    isSelected
                      ? { borderColor: accent, backgroundColor: `${accent}15` }
                      : { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }
                  }
                >
                  <span className="font-medium">{mod.name}</span>
                  <span className="flex items-center gap-2">
                    {mod.priceAdjustment > 0 && (
                      <span className="text-white/40">+{formatPrice(mod.priceAdjustment, currency)}</span>
                    )}
                    {isSelected && <Check className="h-3.5 w-3.5" style={{ color: accent }} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Total + Add to order (placeholder) */}
      <div className="pt-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-white/50">Total</span>
          <span className="text-2xl font-bold" style={{ color: accent }}>{formatPrice(totalPrice, currency)}</span>
        </div>
        <button
          disabled={cartLoading}
          onClick={() => {
            const mods = Object.entries(selectedModifiers).reduce<Record<string, string[]>>((acc, [gId, set]) => {
              if (set.size > 0) acc[gId] = Array.from(set);
              return acc;
            }, {});
            addItem(productId, selectedVariant || undefined, 1, Object.keys(mods).length > 0 ? mods : undefined);
          }}
          className="w-full py-4 rounded-lg text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          style={{ backgroundColor: accent, color: '#0a0a0a' }}
        >
          {cartLoading ? 'Adding…' : `Add to Order — ${formatPrice(totalPrice, currency)}`}
        </button>
      </div>
    </div>
  );
}
