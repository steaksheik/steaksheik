
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, MailX, CheckCircle } from 'lucide-react';

const ACCENT = '#c9a96e';

function channelLabel(channel: string): string {
  if (channel === 'sms') return 'marketing texts';
  if (channel === 'all') return 'marketing emails and texts';
  return 'marketing emails';
}

export default function UnsubscribePage() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const channel = (params.get('channel') ?? 'email') as 'email' | 'sms' | 'all';
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleConfirm() {
    setState('loading');
    try {
      const res = await fetch('/api/v1/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, channel }),
      });
      if (res.ok) {
        setState('done');
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error?.message || 'This unsubscribe link is invalid or has expired.');
        setState('error');
      }
    } catch {
      setError('Network error — please try again.');
      setState('error');
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center">
        <p className="text-neutral-400">This unsubscribe link is missing information. Please use the link from your email or text message.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-24 px-4 text-center">
      {state === 'done' ? (
        <>
          <CheckCircle className="h-10 w-10 mx-auto mb-4" style={{ color: ACCENT }} />
          <h1 className="font-heading text-2xl tracking-wide mb-2">UNSUBSCRIBED</h1>
          <p className="text-sm text-neutral-400">
            You won't receive {channelLabel(channel)} from us anymore. You can re-enable this anytime from your account preferences.
          </p>
        </>
      ) : (
        <>
          <MailX className="h-10 w-10 mx-auto mb-4 text-neutral-400" />
          <h1 className="font-heading text-2xl tracking-wide mb-2">UNSUBSCRIBE</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Confirm you'd like to stop receiving {channelLabel(channel)} from us.
          </p>
          {state === 'error' && <p className="text-sm text-red-400 mb-4">{error}</p>}
          <button
            onClick={handleConfirm}
            disabled={state === 'loading'}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide"
            style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
          >
            {state === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Unsubscribe
          </button>
        </>
      )}
      <div className="mt-8">
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Back to home</Link>
      </div>
    </div>
  );
}
