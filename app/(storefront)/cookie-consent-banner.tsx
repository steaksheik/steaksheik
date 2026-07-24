
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cookie } from 'lucide-react';

const ACCENT = '#c9a96e';
const CONSENT_COOKIE = 'ck_consent';

function setConsentCookie(value: 'accepted' | 'rejected') {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * UK PECR/GDPR cookie banner. Analytics/marketing scripts (GA4/GTM) are only
 * ever rendered server-side after this cookie is set to "accepted" — see
 * layout.tsx. This banner itself doesn't set any non-essential cookie; the
 * consent choice cookie is strictly necessary bookkeeping, exempt from
 * needing its own consent.
 */
export function CookieConsentBanner({ hasDecision }: { hasDecision: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(!hasDecision);

  function respond(value: 'accepted' | 'rejected') {
    setConsentCookie(value);
    setVisible(false);
    // Re-run server components so layout.tsx picks up the new cookie value
    // and starts (or continues to skip) rendering GA4/GTM.
    router.refresh();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6">
      <div className="mx-auto max-w-3xl rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-200 font-medium mb-1">We use cookies</p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              We use strictly necessary cookies to run this site (cart, login, security). With your permission,
              we'd also like to use analytics cookies to understand how the site is used. You can change your
              mind anytime in your account preferences.
            </p>
            <div className="flex flex-wrap gap-2.5 mt-4">
              <button
                onClick={() => respond('accepted')}
                className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide"
                style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
              >
                Accept All
              </button>
              <button
                onClick={() => respond('rejected')}
                className="px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide border border-white/15 text-neutral-300 hover:text-white hover:border-white/30 transition-colors"
              >
                Necessary Only
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
