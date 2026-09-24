'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Cloudflare Turnstile widget for public forms.
 *
 * Renders nothing at all when NEXT_PUBLIC_TURNSTILE_SITEKEY is unset, so
 * forms keep working untouched on deployments where Turnstile isn't
 * configured (local dev, Vercel previews) — the server side fails open to
 * match.
 *
 * Rendered explicitly rather than via auto-render, because a token is
 * single-use: these forms stay on the page after submitting, so each one
 * needs to reset its own widget to get a fresh token for a retry.
 */

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;

/**
 * Whether this build ships a sitekey — i.e. whether a form should wait for a
 * token before letting the visitor submit. Forms must gate their submit button
 * on this rather than on the token alone, or an unconfigured deployment (where
 * the widget renders nothing and no token ever arrives) would be unsubmittable.
 */
export const turnstileConfigured = Boolean(SITEKEY);

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      action?: string;
      theme?: 'auto' | 'light' | 'dark';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Load the Turnstile script once per page, resolving when window.turnstile exists. */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  return new Promise((resolve) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (!existing) {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    // The script sets window.turnstile asynchronously — poll briefly rather
    // than relying on an onload callback that may already have fired.
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.turnstile || Date.now() - started > 10_000) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

export interface TurnstileHandle {
  /** Clear the used token and issue a fresh challenge (call after each submit). */
  reset: () => void;
}

export const TurnstileWidget = forwardRef<
  TurnstileHandle,
  {
    /** Must match the action the server verifies for this form. */
    action: string;
    /** Receives the token, or null when it expires / errors. */
    onToken: (token: string | null) => void;
    /**
     * Fired when the challenge cannot complete — most often because the site's
     * hostname isn't on the widget's domain list in the Cloudflare dashboard.
     * Lets a form say "verification failed to load" instead of sitting on a
     * disabled submit button with no explanation.
     */
    onError?: (code: 'error' | 'expired') => void;
    /** Match the surrounding section — the storefront is dark, the newsletter band is light. */
    theme?: 'auto' | 'light' | 'dark';
    className?: string;
  }
>(function TurnstileWidget({ action, onToken, onError, theme = 'dark', className }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Keep the latest callbacks without re-rendering the widget when they change.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        onTokenRef.current(null);
      }
    },
  }));

  useEffect(() => {
    if (!SITEKEY) return;
    let cancelled = false;

    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return; // already rendered
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITEKEY,
        action,
        theme,
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => {
          onTokenRef.current(null);
          onErrorRef.current?.('expired');
        },
        'error-callback': () => {
          onTokenRef.current(null);
          onErrorRef.current?.('error');
        },
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, theme]);

  if (!SITEKEY) return null;
  return <div ref={containerRef} className={className} />;
});
