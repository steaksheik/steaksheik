'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAccentColor } from '../theme-context';
import { TurnstileWidget, turnstileConfigured, type TurnstileHandle } from '../turnstile-widget';

export function ContactForm() {
  const ACCENT = useAccentColor();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileFailed, setTurnstileFailed] = useState(false);
  const turnstileRef = useRef<TurnstileHandle | null>(null);

  // Only wait on a token when this build actually renders a widget, and stop
  // waiting the moment it reports failure — a broken check must never leave
  // the visitor with a button they can't click.
  const awaitingToken = turnstileConfigured && !turnstileToken && !turnstileFailed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Please fill in your name, email and message');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          subject: subject.trim() || undefined,
          message: message.trim(),
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Something went wrong');
      setSent(true);
    } catch (err) {
      // Turnstile tokens are single-use — issue a fresh one for the retry.
      turnstileRef.current?.reset();
      toast.error((err as Error).message || 'Failed to send — please try again');
    } finally {
      setSending(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25';

  if (sent) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10" style={{ color: ACCENT }} />
        <h2 className="mt-4 font-heading text-2xl font-bold text-white">Message Sent</h2>
        <p className="mt-2 text-sm text-white/50">
          Thanks for getting in touch — we&apos;ll get back to you as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-white/40">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="Your name" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-white/40">Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="you@example.com" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-white/40">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="Optional" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-white/40">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="What's it about?" />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-white/40">Message *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={6}
          className={inputCls}
          placeholder="How can we help?"
        />
      </div>

      <TurnstileWidget
        ref={turnstileRef}
        action="contact"
        onToken={(t) => {
          setTurnstileToken(t);
          if (t) setTurnstileFailed(false);
        }}
        onError={() => setTurnstileFailed(true)}
      />

      {turnstileFailed ? (
        <p className="text-xs text-amber-400/80">
          The human-verification check didn&apos;t load — refreshing the page usually fixes it. You can
          still send, but it may not get through.
        </p>
      ) : awaitingToken ? (
        <p className="text-xs text-white/40">Verifying you&apos;re human…</p>
      ) : null}

      <button
        type="submit"
        disabled={sending || awaitingToken}
        className="inline-flex items-center justify-center gap-2 rounded-md px-7 py-3 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.02] disabled:opacity-60"
        style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
      >
        {sending && <Loader2 className="h-4 w-4 animate-spin" />}
        {sending ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
