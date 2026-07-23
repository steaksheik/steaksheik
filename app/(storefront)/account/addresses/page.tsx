'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, MapPin, Trash2, Star, Pencil, X } from 'lucide-react';

const ACCENT = '#c9a96e';

interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

const EMPTY: Omit<Address, 'id'> = {
  label: 'Home', firstName: '', lastName: '', line1: '', line2: null,
  city: '', county: null, postcode: '', country: 'GB', phone: null, isDefault: false,
};

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Address | (Omit<Address, 'id'> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/customers/addresses');
    if (res.ok) { const json = await res.json(); setAddresses(json.data); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const isNew = !('id' in editing) || !editing.id;
      const url = isNew ? '/api/v1/customers/addresses' : `/api/v1/customers/addresses/${editing.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editing.label,
          firstName: editing.firstName,
          lastName: editing.lastName,
          line1: editing.line1,
          line2: editing.line2 || undefined,
          city: editing.city,
          county: editing.county || undefined,
          postcode: editing.postcode,
          phone: editing.phone || undefined,
          isDefault: editing.isDefault,
        }),
      });
      if (res.ok) {
        toast.success(isNew ? 'Address added' : 'Address updated');
        setEditing(null);
        load();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || 'Failed');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this address?')) return;
    const res = await fetch(`/api/v1/customers/addresses/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Address deleted'); load(); }
    else toast.error('Failed to delete');
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: ACCENT }} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl tracking-wide mb-1">SAVED ADDRESSES</h2>
          <p className="text-sm text-neutral-400">Manage your delivery addresses</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
        >
          <Plus className="h-4 w-4" />
          Add Address
        </button>
      </div>

      {/* Address form modal */}
      {editing && (
        <div className="border border-white/10 rounded-xl p-5 space-y-4 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg tracking-wide">{editing.id ? 'EDIT ADDRESS' : 'NEW ADDRESS'}</h3>
            <button onClick={() => setEditing(null)} className="text-neutral-400 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Label" value={editing.label} onChange={v => setEditing({ ...editing, label: v })} placeholder="Home, Work..." />
            <div />
            <InputField label="First Name" value={editing.firstName} onChange={v => setEditing({ ...editing, firstName: v })} />
            <InputField label="Last Name" value={editing.lastName} onChange={v => setEditing({ ...editing, lastName: v })} />
            <InputField label="Address Line 1" value={editing.line1} onChange={v => setEditing({ ...editing, line1: v })} className="sm:col-span-2" />
            <InputField label="Address Line 2" value={editing.line2 || ''} onChange={v => setEditing({ ...editing, line2: v || null })} className="sm:col-span-2" />
            <InputField label="City" value={editing.city} onChange={v => setEditing({ ...editing, city: v })} />
            <InputField label="County" value={editing.county || ''} onChange={v => setEditing({ ...editing, county: v || null })} />
            <InputField label="Postcode" value={editing.postcode} onChange={v => setEditing({ ...editing, postcode: v })} />
            <InputField label="Phone" value={editing.phone || ''} onChange={v => setEditing({ ...editing, phone: v || null })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={editing.isDefault} onChange={e => setEditing({ ...editing, isDefault: e.target.checked })} className="rounded" />
            Set as default address
          </label>
          <button
            onClick={handleSave}
            disabled={saving || !editing.firstName || !editing.lastName || !editing.line1 || !editing.city || !editing.postcode}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: ACCENT, color: '#0a0a0a' }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing.id ? 'Update Address' : 'Save Address'}
          </button>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 && !editing ? (
        <div className="text-center py-16">
          <MapPin className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
          <p className="text-neutral-400">No saved addresses</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map(addr => (
            <div key={addr.id} className="border border-white/10 rounded-xl p-5 relative group">
              {addr.isDefault && (
                <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[#c9a96e]/20 text-[#c9a96e]">
                  <Star className="h-3 w-3" /> Default
                </span>
              )}
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{addr.label}</p>
              <p className="text-sm text-white">{addr.firstName} {addr.lastName}</p>
              <p className="text-sm text-neutral-300">{addr.line1}</p>
              {addr.line2 && <p className="text-sm text-neutral-300">{addr.line2}</p>}
              <p className="text-sm text-neutral-300">{addr.city}{addr.county ? `, ${addr.county}` : ''}</p>
              <p className="text-sm text-neutral-300">{addr.postcode}</p>
              {addr.phone && <p className="text-sm text-neutral-400 mt-1">{addr.phone}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setEditing(addr)}
                  className="text-xs text-neutral-400 hover:text-white inline-flex items-center gap-1 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="text-xs text-neutral-400 hover:text-red-400 inline-flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, className }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a96e]/50"
      />
    </div>
  );
}
