'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/lib/cart-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Truck, Store, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

const ACCENT = '#c9a96e';

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

interface CustomerSession {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export default function CheckoutPage() {
  const { items, subtotal, deliveryFee, total, token, clearLocalCart, itemCount } = useCart();
  const router = useRouter();
  const params = useSearchParams();
  const cancelled = params.get('cancelled');

  const [orderType, setOrderType] = useState<'DELIVERY' | 'COLLECTION'>('DELIVERY');
  const [mode, setMode] = useState<'guest' | 'login' | 'register'>('guest');
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    line1: '', line2: '', city: '', postcode: '', notes: '',
    loginEmail: '', loginPassword: '',
    regFirstName: '', regLastName: '', regEmail: '', regPassword: '', regPhone: '',
  });

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    fetch('/api/v1/customers/session')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setCustomer(json.data);
          setForm(prev => ({
            ...prev,
            firstName: json.data.firstName || '',
            lastName: json.data.lastName || '',
            email: json.data.email || '',
          }));
        }
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (cancelled) toast.error('Payment was cancelled. You can try again.');
  }, [cancelled]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.loginEmail, password: form.loginPassword }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setCustomer(json.data);
      setForm(prev => ({
        ...prev,
        firstName: json.data.firstName || prev.firstName,
        lastName: json.data.lastName || prev.lastName,
        email: json.data.email || prev.email,
      }));
      setMode('guest');
      toast.success('Signed in!');
    } catch (e) {
      toast.error((e as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.regEmail, password: form.regPassword,
          firstName: form.regFirstName, lastName: form.regLastName, phone: form.regPhone,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      // Auto-login
      const lr = await fetch('/api/v1/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.regEmail, password: form.regPassword }),
      });
      const lj = await lr.json();
      if (lj.success) {
        setCustomer(lj.data);
        setForm(prev => ({ ...prev, firstName: lj.data.firstName || '', lastName: lj.data.lastName || '', email: lj.data.email || '' }));
        setMode('guest');
      }
      toast.success('Account created!');
    } catch (e) {
      toast.error((e as Error).message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!token) return toast.error('Cart is empty');
    const emailVal = customer?.email || form.email;
    if (!emailVal) return toast.error('Email is required');
    if (orderType === 'DELIVERY' && (!form.firstName || !form.line1 || !form.city || !form.postcode)) {
      return toast.error('Please complete the delivery address');
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { cartToken: token, type: orderType };
      if (customer) {
        payload.customerId = customer.customerId;
      } else {
        payload.guestEmail = form.email;
        payload.guestName = `${form.firstName} ${form.lastName}`.trim();
        payload.guestPhone = form.phone;
      }
      if (orderType === 'DELIVERY') {
        Object.assign(payload, {
          deliveryFirstName: form.firstName, deliveryLastName: form.lastName,
          deliveryLine1: form.line1, deliveryLine2: form.line2,
          deliveryCity: form.city, deliveryPostcode: form.postcode,
          deliveryPhone: form.phone, deliveryNotes: form.notes,
        });
      }
      const res = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      clearLocalCart();
      if (json.data.sessionUrl) {
        window.location.href = json.data.sessionUrl;
      } else {
        router.push(`/order-confirmation?orderNumber=${json.data.orderNumber}`);
      }
    } catch (e) {
      toast.error((e as Error).message || 'Checkout failed');
      setLoading(false);
    }
  };

  if (checkingSession) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>;
  }

  if (itemCount === 0 && !cancelled) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-white/50">
        <p className="text-lg">Your cart is empty</p>
        <Link href="/menu" className="text-sm underline" style={{ color: ACCENT }}>Browse the menu</Link>
      </div>
    );
  }

  const effFee = orderType === 'COLLECTION' ? 0 : deliveryFee;
  const effTotal = subtotal + effFee;

  const inputCls = 'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#c9a96e] focus:outline-none';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <Link href="/menu" className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white/70 mb-8">
        <ArrowLeft className="h-4 w-4" /> Back to menu
      </Link>
      <h1 className="font-heading text-3xl sm:text-4xl mb-8">CHECKOUT</h1>

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Order type */}
          <div>
            <h2 className="font-heading text-xl mb-4">ORDER TYPE</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['DELIVERY', 'COLLECTION'] as const).map(t => (
                <button key={t} onClick={() => setOrderType(t)}
                  className="flex items-center gap-3 rounded-lg border p-4 transition-all"
                  style={orderType === t ? { borderColor: ACCENT, backgroundColor: `${ACCENT}15` } : { borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  {t === 'DELIVERY' ? <Truck className="h-5 w-5" style={orderType === t ? { color: ACCENT } : {}} /> : <Store className="h-5 w-5" style={orderType === t ? { color: ACCENT } : {}} />}
                  <div className="text-left">
                    <div className="text-sm font-bold">{t === 'DELIVERY' ? 'Delivery' : 'Collection'}</div>
                    <div className="text-xs text-white/40">{t === 'DELIVERY' ? (effFee === 0 ? 'Free' : fmt(effFee)) : 'No delivery fee'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Account / Guest */}
          {!customer ? (
            <div>
              <h2 className="font-heading text-xl mb-4">YOUR DETAILS</h2>
              <div className="flex gap-2 mb-4">
                {(['guest', 'login', 'register'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className="rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors"
                    style={mode === m ? { backgroundColor: ACCENT, color: '#0a0a0a' } : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}
                  >{m === 'guest' ? 'Guest' : m === 'login' ? 'Sign In' : 'Register'}</button>
                ))}
              </div>
              {mode === 'guest' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="First name *" value={form.firstName} onChange={e => set('firstName', e.target.value)} className={inputCls} />
                    <input placeholder="Last name" value={form.lastName} onChange={e => set('lastName', e.target.value)} className={inputCls} />
                  </div>
                  <input type="email" placeholder="Email *" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
                  <input placeholder="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} />
                </div>
              )}
              {mode === 'login' && (
                <div className="space-y-3 max-w-sm">
                  <input type="email" placeholder="Email" value={form.loginEmail} onChange={e => set('loginEmail', e.target.value)} className={inputCls} />
                  <input type="password" placeholder="Password" value={form.loginPassword} onChange={e => set('loginPassword', e.target.value)} className={inputCls} />
                  <button disabled={loading} onClick={handleLogin} className="rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50" style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </div>
              )}
              {mode === 'register' && (
                <div className="space-y-3 max-w-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="First name" value={form.regFirstName} onChange={e => set('regFirstName', e.target.value)} className={inputCls} />
                    <input placeholder="Last name" value={form.regLastName} onChange={e => set('regLastName', e.target.value)} className={inputCls} />
                  </div>
                  <input type="email" placeholder="Email" value={form.regEmail} onChange={e => set('regEmail', e.target.value)} className={inputCls} />
                  <input type="password" placeholder="Password (min 8 chars)" value={form.regPassword} onChange={e => set('regPassword', e.target.value)} className={inputCls} />
                  <input placeholder="Phone (optional)" value={form.regPhone} onChange={e => set('regPhone', e.target.value)} className={inputCls} />
                  <button disabled={loading} onClick={handleRegister} className="rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50" style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}>
                    {loading ? 'Creating…' : 'Create Account'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{customer.firstName} {customer.lastName}</p>
                  <p className="text-xs text-white/40">{customer.email}</p>
                </div>
                <button onClick={() => { fetch('/api/v1/customers/session', { method: 'DELETE' }); setCustomer(null); }} className="text-xs text-white/40 hover:text-white/60 underline">Sign out</button>
              </div>
            </div>
          )}

          {/* Delivery address */}
          {orderType === 'DELIVERY' && (
            <div>
              <h2 className="font-heading text-xl mb-4">DELIVERY ADDRESS</h2>
              <div className="space-y-3">
                <input placeholder="Address line 1 *" value={form.line1} onChange={e => set('line1', e.target.value)} className={inputCls} />
                <input placeholder="Address line 2" value={form.line2} onChange={e => set('line2', e.target.value)} className={inputCls} />
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="City *" value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} />
                  <input placeholder="Postcode *" value={form.postcode} onChange={e => set('postcode', e.target.value)} className={inputCls} />
                </div>
                <textarea placeholder="Delivery notes (optional)" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className={`${inputCls} resize-none`} />
              </div>
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
            <h2 className="font-heading text-xl">ORDER SUMMARY</h2>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div>
                    <span className="text-white/80">{item.quantity}x</span>{' '}
                    <span>{item.productName}</span>
                    {item.variantName && <span className="text-white/40 text-xs"> ({item.variantName})</span>}
                  </div>
                  <span className="font-bold">{fmt(item.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex justify-between text-sm text-white/60"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between text-sm text-white/60"><span>Delivery</span><span>{effFee === 0 ? 'Free' : fmt(effFee)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
                <span>Total</span><span style={{ color: ACCENT }}>{fmt(effTotal)}</span>
              </div>
            </div>
            <button disabled={loading} onClick={handleCheckout}
              className="w-full rounded-lg py-4 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
            >
              {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing…</span> : `Pay ${fmt(effTotal)}`}
            </button>
            <p className="text-center text-[11px] text-white/30">Secure payment via Stripe</p>
          </div>
        </div>
      </div>
    </div>
  );
}
