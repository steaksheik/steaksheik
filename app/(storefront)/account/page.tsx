'use client';

import { useState, useEffect } from 'react';
import { useCustomer } from '@/lib/customer-context';
import { toast } from 'sonner';
import { Loader2, Save, Lock } from 'lucide-react';

const ACCENT = '#c9a96e';

export default function ProfilePage() {
  const { customer, refresh } = useCustomer();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Communication preferences (PECR/GDPR marketing consent)
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  // Password change
  const [showPwd, setShowPwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/v1/customers/profile');
      if (res.ok) {
        const json = await res.json();
        const d = json.data;
        setFirstName(d.firstName || '');
        setLastName(d.lastName || '');
        setPhone(d.phone || '');
        setEmail(d.email || '');
        setEmailConsent(Boolean(d.marketingEmailConsent));
        setSmsConsent(Boolean(d.marketingSmsConsent));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleConsentChange(field: 'email' | 'sms', value: boolean) {
    const prevEmail = emailConsent;
    const prevSms = smsConsent;
    if (field === 'email') setEmailConsent(value); else setSmsConsent(value);
    setSavingConsent(true);
    try {
      const res = await fetch('/api/v1/customers/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          field === 'email' ? { marketingEmailConsent: value } : { marketingSmsConsent: value }
        ),
      });
      if (res.ok) {
        toast.success(value ? 'Subscribed' : 'Unsubscribed');
      } else {
        // Revert on failure
        setEmailConsent(prevEmail);
        setSmsConsent(prevSms);
        const json = await res.json();
        toast.error(json.error?.message || 'Failed to update preference');
      }
    } catch {
      setEmailConsent(prevEmail);
      setSmsConsent(prevSms);
      toast.error('Network error');
    } finally {
      setSavingConsent(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/customers/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phone: phone || undefined }),
      });
      if (res.ok) {
        toast.success('Profile updated');
        refresh();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || 'Failed to update');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (newPwd !== confirmPwd) { toast.error('Passwords do not match'); return; }
    if (newPwd.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setChangingPwd(true);
    try {
      const res = await fetch('/api/v1/customers/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      if (res.ok) {
        toast.success('Password changed successfully');
        setShowPwd(false);
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
      } else {
        const json = await res.json();
        toast.error(json.error?.message || 'Failed to change password');
      }
    } finally {
      setChangingPwd(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: ACCENT }} /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-xl tracking-wide mb-1">PROFILE DETAILS</h2>
        <p className="text-sm text-neutral-400">Manage your personal information</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">First Name</label>
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">Last Name</label>
          <input
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">Email</label>
          <input
            value={email}
            disabled
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-neutral-500 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">Phone</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+44 7XXX XXXXXX"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Changes
      </button>

      {/* Communication Preferences */}
      <div className="border-t border-white/10 pt-8">
        <h3 className="font-heading text-lg tracking-wide mb-1">COMMUNICATION PREFERENCES</h3>
        <p className="text-sm text-neutral-400 mb-4">Choose what marketing messages you'd like to receive. This never affects order confirmations or delivery updates.</p>
        <div className="space-y-3 max-w-md">
          <label className="flex items-start gap-2.5 text-sm text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={emailConsent}
              disabled={savingConsent}
              onChange={e => handleConsentChange('email', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5"
            />
            <span>Marketing emails about offers and new menu items</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={smsConsent}
              disabled={savingConsent}
              onChange={e => handleConsentChange('sms', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5"
            />
            <span>Marketing texts about offers and new menu items</span>
          </label>
        </div>
      </div>

      {/* Password Section */}
      <div className="border-t border-white/10 pt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading text-lg tracking-wide">PASSWORD</h3>
            <p className="text-sm text-neutral-400">Change your account password</p>
          </div>
          {!showPwd && (
            <button
              onClick={() => setShowPwd(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-colors"
            >
              <Lock className="h-4 w-4" />
              Change Password
            </button>
          )}
        </div>
        {showPwd && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePasswordChange}
                disabled={changingPwd}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
              >
                {changingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Update Password
              </button>
              <button
                onClick={() => { setShowPwd(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); }}
                className="px-5 py-2.5 rounded-lg text-sm border border-white/10 text-neutral-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
