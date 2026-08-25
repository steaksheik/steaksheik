'use client';

import { createContext, useContext } from 'react';

// Must match the storefront's hardcoded fallback that predates this context,
// and the branding admin's own defaults — so a tenant with no theme saved yet
// (or a context consumed outside the provider, e.g. in tests) still renders
// the site's actual brand gold instead of some unrelated placeholder color.
export const DEFAULT_ACCENT = '#c9a96e';

const AccentColorContext = createContext<string>(DEFAULT_ACCENT);

/**
 * Makes the tenant's live brand accent colour (Admin -> Branding -> Theme)
 * available to every client component under the storefront layout, without
 * prop-drilling it through every page and the globally-mounted CartDrawer /
 * CookieConsentBanner. Fed once, server-side, from the brand fetched in
 * layout.tsx — so a saved colour change shows up everywhere on next load.
 */
export function BrandThemeProvider({
  accentColor,
  children,
}: {
  accentColor: string | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <AccentColorContext.Provider value={accentColor || DEFAULT_ACCENT}>
      {children}
    </AccentColorContext.Provider>
  );
}

/** The site's live brand accent colour. */
export function useAccentColor(): string {
  return useContext(AccentColorContext);
}
