'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, MapPin, CheckCircle2, AlertTriangle, Clock, Share2 } from 'lucide-react';
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
  businessHours: Record<string, { open: string; close: string; closed?: boolean }> | null;
}

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
] as const;

type DayKey = (typeof DAYS)[number]['key'];
type HoursState = Record<DayKey, { open: string; close: string; closed: boolean }>;

const DEFAULT_HOURS: HoursState = DAYS.reduce((acc, d) => {
  acc[d.key] = { open: '16:00', close: '23:00', closed: false };
  return acc;
}, {} as HoursState);

const SOCIAL_PLATFORMS = [
  { key: 'FACEBOOK', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
  { key: 'INSTAGRAM', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
  { key: 'TIKTOK', label: 'TikTok', placeholder: 'https://tiktok.com/@yourhandle' },
  { key: 'YOUTUBE', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'TWITTER', label: 'X / Twitter', placeholder: 'https://x.com/yourhandle' },
  { key: 'LINKEDIN', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/you' },
] as const;

export default function StoreLocationPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', phone: '', address: '', city: '', postcode: '', country: 'GB' });
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const [radiusMiles, setRadiusMiles] = useState('');
  const [radiusSaving, setRadiusSaving] = useState(false);
  const [hours, setHours] = useState<HoursState>(DEFAULT_HOURS);
  const [hoursSaving, setHoursSaving] = useState(false);
  // "Same hours every day" is a UI convenience only — storage is always
  // per-day, so a client can switch to a varied week without losing anything.
  const [sameEveryDay, setSameEveryDay] = useState(true);
  const [social, setSocial] = useState<Record<string, string>>({});
  const [socialSaving, setSocialSaving] = useState(false);

  const canRead = hasPermission('config:settings:read');
  const canWrite = hasPermission('config:settings:write');

  const load = useCallback(async () => {
    if (!canRead) { setLoading(false); return; }
    setLoading(true);
    try {
      const [contactRes, radiusRes, socialRes] = await Promise.all([
        fetch('/api/v1/contact-info', { headers: authHeaders() }),
        fetch('/api/v1/config/delivery/radiusMiles', { headers: authHeaders() }),
        fetch('/api/v1/social-links', { headers: authHeaders() }),
      ]);
      if (contactRes.ok) {
        const json = await contactRes.json();
        const c: ContactInfo | null = json.data?.contactInfo ?? null;
        if (c) {
          setForm({
            email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '',
            city: c.city ?? '', postcode: c.postcode ?? '', country: c.country ?? 'GB',
          });
          setCoords({ latitude: c.latitude, longitude: c.longitude });
          if (c.businessHours) {
            const loaded = DAYS.reduce((acc, d) => {
              const saved = c.businessHours?.[d.key];
              acc[d.key] = saved
                ? { open: saved.open, close: saved.close, closed: Boolean(saved.closed) }
                : DEFAULT_HOURS[d.key];
              return acc;
            }, {} as HoursState);
            setHours(loaded);
            // Open in whichever mode matches what's actually saved.
            const first = loaded[DAYS[0].key];
            setSameEveryDay(
              DAYS.every((d) =>
                loaded[d.key].open === first.open &&
                loaded[d.key].close === first.close &&
                loaded[d.key].closed === first.closed,
              ),
            );
          }
        }
      }
      if (radiusRes.ok) {
        const json = await radiusRes.json();
        if (typeof json.data?.value === 'number') setRadiusMiles(String(json.data.value));
      }
      if (socialRes.ok) {
        const json = await socialRes.json();
        const links = (json.data?.socialLinks ?? []) as { platform: string; url: string }[];
        setSocial(Object.fromEntries(links.map((l) => [l.platform, l.url])));
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

  /** Apply Monday's times to every other day. */
  function copyMondayToAll() {
    const src = hours.mon;
    setHours(DAYS.reduce((acc, d) => {
      acc[d.key] = { ...src };
      return acc;
    }, {} as HoursState));
    toast.success('Monday’s hours copied to every day');
  }

  async function saveHours() {
    setHoursSaving(true);
    try {
      // In "same every day" mode Monday's inputs are the single source —
      // fan them out so storage stays per-day either way.
      const effective: HoursState = sameEveryDay
        ? DAYS.reduce((acc, d) => { acc[d.key] = { ...hours.mon }; return acc; }, {} as HoursState)
        : hours;
      if (sameEveryDay) setHours(effective);

      const businessHours = Object.fromEntries(
        DAYS.map((d) => [d.key, { open: effective[d.key].open, close: effective[d.key].close, closed: effective[d.key].closed }]),
      );
      const res = await fetch('/api/v1/contact-info', {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        // The API merges, but send the current contact fields too so a
        // partial payload can never blank them out.
        body: JSON.stringify({ ...form, businessHours }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success('Opening hours saved');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save opening hours');
    } finally {
      setHoursSaving(false);
    }
  }

  async function saveSocial() {
    setSocialSaving(true);
    try {
      const links = SOCIAL_PLATFORMS.map((p) => ({ platform: p.key, url: (social[p.key] ?? '').trim() }));
      const res = await fetch('/api/v1/social-links', {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ links }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success('Social links saved');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save social links');
    } finally {
      setSocialSaving(false);
    }
  }

  async function saveRadius() {
    const n = Number(radiusMiles);
    if (!radiusMiles.trim() || !Number.isFinite(n) || n <= 0) {
      toast.error('Enter a delivery radius greater than 0');
      return;
    }
    setRadiusSaving(true);
    try {
      const res = await fetch('/api/v1/config/delivery/radiusMiles', {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ value: n, type: 'NUMBER', isPublic: false }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success(`Delivery radius set to ${n} miles`);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save');
    } finally {
      setRadiusSaving(false);
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Delivery Radius</CardTitle>
          <CardDescription>
            Customers within this distance of the store address above can choose delivery. Requires the address to be geocoded — otherwise checkout falls back to the postcode allow-list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Radius (miles)</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={radiusMiles}
                onChange={e => setRadiusMiles(e.target.value)}
                disabled={!canWrite}
                placeholder="e.g. 3"
                className="w-32"
              />
            </div>
            {canWrite && (
              <Button onClick={saveRadius} disabled={radiusSaving} size="sm">
                {radiusSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Opening hours ── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Opening Hours
          </CardTitle>
          <CardDescription>
            Shown in the storefront footer and on the Contact page. Consecutive days with the same hours are
            grouped automatically (e.g. &ldquo;Mon &ndash; Sun 16:00 &ndash; 23:00&rdquo;).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Mode switch: one set of times for the week, or per-day control. */}
          <div className="flex items-center gap-3 pb-1">
            <Switch
              checked={sameEveryDay}
              disabled={!canWrite}
              onCheckedChange={setSameEveryDay}
              aria-label="Same hours every day"
            />
            <div>
              <Label className="text-sm">Same hours every day</Label>
              <p className="text-xs text-muted-foreground">
                Turn off to set different times per day, or close individual days.
              </p>
            </div>
          </div>

          {sameEveryDay ? (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Label className="w-24 text-sm">Mon &ndash; Sun</Label>
              <Input
                type="time"
                value={hours.mon.open}
                disabled={!canWrite}
                onChange={(e) => setHours((h) => ({ ...h, mon: { ...h.mon, open: e.target.value, closed: false } }))}
                className="w-32"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="time"
                value={hours.mon.close}
                disabled={!canWrite}
                onChange={(e) => setHours((h) => ({ ...h, mon: { ...h.mon, close: e.target.value, closed: false } }))}
                className="w-32"
              />
            </div>
          ) : (
            <>
              {canWrite && (
                <div className="pb-1">
                  <Button variant="outline" size="sm" onClick={copyMondayToAll}>
                    Copy Monday to all days
                  </Button>
                </div>
              )}
              {DAYS.map((d) => (
            <div key={d.key} className="flex flex-wrap items-center gap-3">
              <Label className="w-24 text-sm">{d.label}</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!hours[d.key].closed}
                  disabled={!canWrite}
                  onCheckedChange={(v) => setHours((h) => ({ ...h, [d.key]: { ...h[d.key], closed: !v } }))}
                  aria-label={`${d.label} open`}
                />
                <span className="text-xs text-muted-foreground w-14">
                  {hours[d.key].closed ? 'Closed' : 'Open'}
                </span>
              </div>
              {!hours[d.key].closed && (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={hours[d.key].open}
                    disabled={!canWrite}
                    onChange={(e) => setHours((h) => ({ ...h, [d.key]: { ...h[d.key], open: e.target.value } }))}
                    className="w-32"
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="time"
                    value={hours[d.key].close}
                    disabled={!canWrite}
                    onChange={(e) => setHours((h) => ({ ...h, [d.key]: { ...h[d.key], close: e.target.value } }))}
                    className="w-32"
                  />
                </div>
              )}
            </div>
              ))}
            </>
          )}
          {canWrite && (
            <div className="pt-2">
              <Button onClick={saveHours} disabled={hoursSaving} size="sm">
                {hoursSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save opening hours
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Social links ── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Social Links
          </CardTitle>
          <CardDescription>
            Paste the full profile URL. Only platforms you fill in appear as icons in the storefront footer —
            leave one blank to remove it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {SOCIAL_PLATFORMS.map((p) => (
            <div key={p.key} className="space-y-1.5">
              <Label className="text-sm">{p.label}</Label>
              <Input
                type="url"
                value={social[p.key] ?? ''}
                disabled={!canWrite}
                placeholder={p.placeholder}
                onChange={(e) => setSocial((s) => ({ ...s, [p.key]: e.target.value }))}
              />
            </div>
          ))}
          {canWrite && (
            <Button onClick={saveSocial} disabled={socialSaving} size="sm">
              {socialSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save social links
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
