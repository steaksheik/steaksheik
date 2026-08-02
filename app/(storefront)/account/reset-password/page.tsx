'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomer } from '@/lib/customer-context';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const ACCENT = '#c9a96e';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { refresh } = useCustomer();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Read ?token= without useSearchParams, matching account/login/page.tsx's
  // approach so this page doesn't need a Suspense boundary just for a deep link.
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token'));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/customers/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const json = await res.json();
      if (json.success) {
        await refresh();
        toast.success('Password set — you’re signed in');
        router.replace('/account');
      } else {
        toast.error(json.error?.message || 'This link is invalid or has expired');
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
        SET NEW PASSWORD
      </h1>

      {token === null ? (
        <p className="text-sm text-neutral-400 text-center py-4">Loading…</p>
      ) : !token ? (
        <p className="text-sm text-neutral-400 text-center py-4">
          This link is missing its token. Please use the link from your email, or{' '}
          <Link href="/account/forgot-password" className="font-semibold" style={{ color: ACCENT }}>request a new one</Link>.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Set Password
          </button>
        </form>
      )}
    </div>
  );
}
