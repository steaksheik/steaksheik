'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomer } from '@/lib/customer-context';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const ACCENT = '#c9a96e';

export default function CustomerLoginPage() {
  const router = useRouter();
  const { refresh } = useCustomer();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  // Read ?mode=register&redirect=/account/loyalty without useSearchParams,
  // so this page doesn't need a Suspense boundary just for a deep link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'register') setMode('register');
  }, []);

  function redirectDestination(): string {
    if (typeof window === 'undefined') return '/account';
    return new URLSearchParams(window.location.search).get('redirect') || '/account';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await fetch('/api/v1/customers/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (res.ok) {
          await refresh();
          router.replace(redirectDestination());
        } else {
          const json = await res.json();
          toast.error(json.error?.message || 'Login failed');
        }
      } else {
        if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        const res = await fetch('/api/v1/customers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email, password, firstName, lastName,
            marketingEmailConsent: emailConsent,
            marketingSmsConsent: smsConsent,
          }),
        });
        if (res.ok) {
          // Auto-login after registration
          const loginRes = await fetch('/api/v1/customers/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          if (loginRes.ok) {
            await refresh();
            router.replace(redirectDestination());
          }
        } else {
          const json = await res.json();
          toast.error(json.error?.message || 'Registration failed');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <h1 className="font-heading text-3xl tracking-wide text-center mb-2" style={{ color: ACCENT }}>
        {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
      </h1>
      <p className="text-sm text-neutral-400 text-center mb-8">
        {mode === 'login' ? 'Access your orders and rewards' : 'Join to earn rewards with every order'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">First Name</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">Last Name</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
              />
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs uppercase tracking-wider text-neutral-400">Password</label>
            {mode === 'login' && (
              <Link href="/account/forgot-password" className="text-xs text-neutral-400 hover:text-white transition-colors">
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
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
        {mode === 'register' && (
          <div className="space-y-2.5 pt-1">
            <label className="flex items-start gap-2.5 text-xs text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={emailConsent}
                onChange={e => setEmailConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5"
              />
              <span>Send me marketing emails about offers and new menu items. You can unsubscribe anytime.</span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={e => setSmsConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5"
              />
              <span>Send me marketing texts about offers and new menu items. Reply STOP anytime to opt out.</span>
            </label>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.01]"
          style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <p className="text-sm text-neutral-400 text-center mt-6">
        {mode === 'login' ? (
          <>Don&apos;t have an account?{' '}
            <button onClick={() => setMode('register')} className="font-semibold" style={{ color: ACCENT }}>Create one</button>
          </>
        ) : (
          <>Already have an account?{' '}
            <button onClick={() => setMode('login')} className="font-semibold" style={{ color: ACCENT }}>Sign in</button>
          </>
        )}
      </p>

      <div className="text-center mt-4">
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Back to home</Link>
      </div>
    </div>
  );
}
