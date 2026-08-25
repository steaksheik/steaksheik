'use client';

import { createContext, useContext } from 'react';

// Must match the storefront's own hardcoded fallbacks that predate this
// context (the site's actual current look — near-black nav/footer, card and
// page surfaces, gold accent) so a tenant with no theme saved yet still
// renders exactly what it always has, instead of some unrelated placeholder.
export const DEFAULT_PRIMARY = '#0a0a0a';
export const DEFAULT_SECONDARY = '#0a0a0a';
export const DEFAULT_BACKGROUND = '#0a0a0a';
export const DEFAULT_ACCENT = '#c9a96e';

export interface BrandThemeValue {
  /** Navbar + footer surfaces. */
  primaryColor: string;
  /** Card / tile surfaces. */
  secondaryColor: string;
  /** Full page canvas on fully-dark pages (menu, product, Wagyu Journey). */
  backgroundColor: string;
  /** Buttons, prices, badges, highlights. */
  accentColor: string;
}

const DEFAULT_THEME: BrandThemeValue = {
  primaryColor: DEFAULT_PRIMARY,
  secondaryColor: DEFAULT_SECONDARY,
  backgroundColor: DEFAULT_BACKGROUND,
  accentColor: DEFAULT_ACCENT,
};

const BrandThemeContext = createContext<BrandThemeValue>(DEFAULT_THEME);

/**
 * Makes the tenant's live brand theme (Admin -> Branding -> Theme) available
 * to every client component under the storefront layout, without
 * prop-drilling it through every page and the globally-mounted CartDrawer /
 * CookieConsentBanner. Fed once, server-side, from the brand fetched in
 * layout.tsx — so a saved colour change shows up everywhere on next load.
 */
export function BrandThemeProvider({
  theme,
  children,
}: {
  theme: Partial<BrandThemeValue> | null | undefined;
  children: React.ReactNode;
}) {
  const value: BrandThemeValue = {
    primaryColor: theme?.primaryColor || DEFAULT_PRIMARY,
    secondaryColor: theme?.secondaryColor || DEFAULT_SECONDARY,
    backgroundColor: theme?.backgroundColor || DEFAULT_BACKGROUND,
    accentColor: theme?.accentColor || DEFAULT_ACCENT,
  };
  return <BrandThemeContext.Provider value={value}>{children}</BrandThemeContext.Provider>;
}

/** The tenant's full live brand theme. */
export function useBrandTheme(): BrandThemeValue {
  return useContext(BrandThemeContext);
}

/** The site's live brand accent colour. */
export function useAccentColor(): string {
  return useContext(BrandThemeContext).accentColor;
}
