'use client';

import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaWindow extends Window {
  __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  __pwaInstalled?: boolean;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as "MacIntel" with touch support
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's own flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Cross-platform "install this PWA" state. Chrome/Edge/Android expose a real
 * beforeinstallprompt event we can trigger programmatically; iOS Safari has
 * no such API at all (an Apple platform restriction, not something any site
 * can work around) — callers should show manual "Share -> Add to Home
 * Screen" instructions instead when `isIOS` is true and `canPrompt` is false.
 *
 * The beforeinstallprompt event itself is captured as early as possible by
 * an inline script in app/layout.tsx's <head> (before this hook, or even
 * React, has mounted) and stashed on window — Chrome fires it once, early,
 * and a listener attached only on component mount can easily miss it.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const w = window as PwaWindow;
    setInstalled(isStandalone() || w.__pwaInstalled === true);

    // Pick up an event that already fired before this component mounted.
    if (w.__pwaInstallPrompt) setDeferredPrompt(w.__pwaInstallPrompt);

    const onReady = () => {
      if (w.__pwaInstallPrompt) setDeferredPrompt(w.__pwaInstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('pwaInstallPromptReady', onReady);
    window.addEventListener('pwaInstalled', onInstalled);
    return () => {
      window.removeEventListener('pwaInstallPromptReady', onReady);
      window.removeEventListener('pwaInstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    (window as PwaWindow).__pwaInstallPrompt = null;
    return outcome;
  }, [deferredPrompt]);

  return {
    canPrompt: deferredPrompt !== null,
    installed,
    isIOS: isIos(),
    promptInstall,
  };
}
