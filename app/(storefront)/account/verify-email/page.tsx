'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCustomer } from '@/lib/customer-context';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const ACCENT = '#c9a96e';

export default function VerifyEmailPage() {
  const { refresh } = useCustomer();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Read ?token= without useSearchParams, matching account/login and
  // account/reset-password so this page doesn't need a Suspense boundary
  // just for a deep link.
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token'));
  }, []);

  useEffect(() => {
    if (token === null) return;
    if (!token) { setStatus('error'); setMessage('This link is missing its token.'); return; }
    setStatus('verifying');
    fetch('/api/v1/customers/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (res.ok) {
          setStatus('success');
          refresh(); // pick up emailVerified: true if this device is signed in
        } else {
          setStatus('error');
          setMessage(json.error?.message || 'This link is invalid or has expired.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error. Please try again.');
      });
  }, [token, refresh]);

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <h1 className="font-heading text-3xl tracking-wide mb-6" style={{ color: ACCENT }}>
        CONFIRM EMAIL
      </h1>

      {(status === 'idle' || status === 'verifying') && (
        <div className="flex flex-col items-center gap-3 py-6 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: ACCENT }} />
          <p className="text-sm">Confirming your email…</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-sm text-neutral-300">Your email address is confirmed.</p>
          <Link href="/account" className="mt-2 text-sm font-semibold" style={{ color: ACCENT }}>
            Go to my account
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <XCircle className="h-10 w-10 text-red-500" />
          <p className="text-sm text-neutral-300">{message}</p>
          <p className="text-sm text-neutral-400">
            Sign in and request a new link from your{' '}
            <Link href="/account" className="font-semibold" style={{ color: ACCENT }}>account page</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
