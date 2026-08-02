'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ContactInfo {
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export default function StoreLocationPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', phone: '', address: '', city: '', postcode: '', country: 'GB' });
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });

  const canRead = hasPermission('config:settings:read');
  const canWrite = hasPermission('config:settings:write');

  const load = useCallback(async () => {
    if (!canRead) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/contact-info', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        const c: ContactInfo | null = json.data?.contactInfo ?? null;
        if (c) {
          setForm({
            email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '',
            city: c.city ?? '', postcode: c.postcode ?? '', country: c.country ?? 'GB',
          });
          setCoords({ latitude: c.latitude, longitude: c.longitude });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [canRead, authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/contact-info', {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      const c = json.data.contactInfo as ContactInfo;
      setCoords({ latitude: c.latitude, longitude: c.longitude });
      if (json.data.geocoded) {
        toast.success('Store location saved and geocoded');
      } else if (form.address) {
        toast.warning('Saved, but couldn’t geocode the address — add a Google Maps API key in Platform Services');
      } else {
        toast.success('Saved');
      }
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!canRead) {
    return <div className="p-6 text-muted-foreground">You don&apos;t have permission to view store location settings.</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const geocodedOk = coords.latitude !== null && coords.longitude !== null && (coords.latitude !== 0 || coords.longitude !== 0);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Store Location</h1>
        <p className="text-muted-foreground text-sm">Used for search/SEO listings and for calculating delivery eligibility</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Address</CardTitle>
          <CardDescription>Saving a new address automatically geocodes it via Google Maps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Street address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} disabled={!canWrite} placeholder="123 High Street" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">City</Label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} disabled={!canWrite} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Postcode</Label>
              <Input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} disabled={!canWrite} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!canWrite} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={!canWrite} />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs pt-1">
            {geocodedOk ? (
              <span className="flex items-center gap-1.5 text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" /> Geocoded ({coords.latitude?.toFixed(5)}, {coords.longitude?.toFixed(5)})
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" /> Not geocoded yet — add a Google Maps API key in Platform Services, then save again
              </span>
            )}
          </div>

          {canWrite && (
            <Button onClick={save} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
