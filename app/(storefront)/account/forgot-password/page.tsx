'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';

const ACCENT = '#c9a96e';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/customers/password/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.success) {
        setSent(true);
      } else {
        toast.error(json.error?.message || 'Something went wrong');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <h1 className="font-heading text-3xl tracking-wide text-center mb-2" style={{ color: ACCENT }}>
        FORGOT PASSWORD
      </h1>
      <p className="text-sm text-neutral-400 text-center mb-8">We&apos;ll email you a link to reset it</p>

      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-8 w-8" style={{ color: ACCENT }} />
          <p className="text-sm text-neutral-400">
            If an account exists for <strong className="text-white">{email}</strong>, a reset link has been sent. Check your inbox.
          </p>
          <Link href="/account/login" className="text-sm font-semibold" style={{ color: ACCENT }}>Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Reset Link
          </button>
          <p className="text-sm text-neutral-400 text-center">
            <Link href="/account/login" className="font-semibold" style={{ color: ACCENT }}>Back to sign in</Link>
          </p>
        </form>
      )}
    </div>
  );
}
