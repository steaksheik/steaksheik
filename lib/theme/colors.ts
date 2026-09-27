/**
 * Readable text colours derived from whatever surface colour the tenant picked.
 *
 * The storefront lets an admin choose the page canvas, card and navbar colours
 * freely, so no text colour can be hardcoded: white body text is invisible the
 * moment someone sets a light background, which is exactly how the storefront
 * used to break. Everything here answers one question — "given this surface,
 * what can be read on top of it?" — so a colour nobody has tried yet still
 * comes out legible.
 *
 * Usable from server and client components alike; no React, no 'use client'.
 */

const NEAR_BLACK = '#0a0a0a';
const WHITE = '#ffffff';

/** Parse #rgb / #rrggbb into 0-255 channels. Returns null for anything else. */
function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG 2.1 relative luminance, 0 (black) to 1 (white). */
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Whether a surface is light enough to need dark text.
 *
 * 0.179 is the luminance where black and white text reach equal contrast
 * against the surface, so it picks whichever of the two actually reads better
 * rather than guessing at "is this a dark colour".
 */
export function isLightSurface(hex: string): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return false; // unparseable — assume the dark default the site ships with
  return luminance(rgb) > 0.179;
}

/** The body text colour that reads on this surface. */
export function onSurface(hex: string): string {
  return isLightSurface(hex) ? NEAR_BLACK : WHITE;
}

/**
 * Text or a hairline at partial strength on this surface — the theme-driven
 * replacement for the `text-white/40` and `border-white/10` utilities that
 * only ever worked on a dark page.
 *
 * Light surfaces get a slightly stronger value at the same nominal alpha,
 * because dark-on-light fades out faster to the eye than light-on-dark.
 */
export function onSurfaceAlpha(hex: string, alpha: number): string {
  const light = isLightSurface(hex);
  const adjusted = light ? Math.min(1, alpha * 1.35) : alpha;
  return light
    ? `rgba(10, 10, 10, ${round(adjusted)})`
    : `rgba(255, 255, 255, ${round(adjusted)})`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * The four values almost every section needs, resolved once from its surface.
 *
 * `subtle` is for faint fills (an empty image well, a tag pill), `border` for
 * hairlines and dividers, `muted` for secondary copy.
 */
export function surfaceTokens(hex: string) {
  return {
    text: onSurface(hex),
    muted: onSurfaceAlpha(hex, 0.55),
    faint: onSurfaceAlpha(hex, 0.38),
    border: onSurfaceAlpha(hex, 0.12),
    subtle: onSurfaceAlpha(hex, 0.04),
  };
}
