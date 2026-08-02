'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ConfigItem {
  id: string;
  module: string;
  key: string;
  value: unknown;
  type: string;
  description: string | null;
  isPublic: boolean;
}

export default function SettingsPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const canWrite = hasPermission('config:settings:write');

  const [rewardsEnabled, setRewardsEnabled] = useState(true);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [rewardsSaving, setRewardsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/config/features/rewardsEnabled', { credentials: 'include', headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (json?.success && typeof json.data?.value === 'boolean') setRewardsEnabled(json.data.value);
      })
      .catch(() => {})
      .finally(() => setRewardsLoading(false));
  }, [authHeaders]);

  async function toggleRewards(next: boolean) {
    setRewardsSaving(true);
    setRewardsEnabled(next);
    try {
      const res = await fetch('/api/v1/config/features/rewardsEnabled', {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ value: next, type: 'BOOLEAN', isPublic: true }),
      });
      const data = await res.json();
      if (data.success) toast.success(`Rewards ${next ? 'enabled' : 'disabled'}`);
      else { toast.error(data.error?.message ?? 'Failed to save'); setRewardsEnabled(!next); }
    } catch {
      toast.error('Network error');
      setRewardsEnabled(!next);
    } finally {
      setRewardsSaving(false);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/config/platform', { credentials: 'include', headers: authHeaders() }).then(r => r.json()),
      fetch('/api/v1/config/catalogue', { credentials: 'include', headers: authHeaders() }).then(r => r.json()),
      fetch('/api/v1/config/seo', { credentials: 'include', headers: authHeaders() }).then(r => r.json()),
      fetch('/api/v1/config/notifications', { credentials: 'include', headers: authHeaders() }).then(r => r.json()),
    ]).then(([p, c, s, n]) => {
      const all = [
        ...(p.data?.configs ?? []),
        ...(c.data?.configs ?? []),
        ...(s.data?.configs ?? []),
        ...(n.data?.configs ?? []),
      ];
      setConfigs(all);
      const vals: Record<string, string> = {};
      for (const cfg of all) {
        vals[`${cfg.module}.${cfg.key}`] = typeof cfg.value === 'object' ? JSON.stringify(cfg.value) : String(cfg.value ?? '');
      }
      setEditValues(vals);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [authHeaders]);

  async function saveConfig(module: string, key: string) {
    const v = editValues[`${module}.${key}`];
    setSaving(`${module}.${key}`);
    try {
      let parsed: unknown = v;
      if (v === 'true') parsed = true;
      else if (v === 'false') parsed = false;
      else if (!isNaN(Number(v)) && v.trim() !== '') parsed = Number(v);

      const res = await fetch(`/api/v1/config/${module}/${key}`, {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ value: parsed }),
      });
      const data = await res.json();
      if (data.success) toast.success(`Saved ${module}.${key}`);
      else toast.error(data.error?.message ?? 'Failed');
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = configs.reduce((acc, c) => {
    (acc[c.module] = acc[c.module] ?? []).push(c);
    return acc;
  }, {} as Record<string, ConfigItem[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Platform configuration values.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Features</CardTitle>
          <CardDescription>Turn optional storefront features on or off</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm">Rewards</Label>
              <p className="text-xs text-muted-foreground">Show the loyalty/rewards program on the storefront, in customer accounts, and in navigation</p>
            </div>
            {rewardsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch checked={rewardsEnabled} onCheckedChange={toggleRewards} disabled={!canWrite || rewardsSaving} />
            )}
          </div>
        </CardContent>
      </Card>

      {Object.entries(grouped).map(([mod, items]) => (
        <Card key={mod} className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base capitalize">{mod}</CardTitle>
            <CardDescription>{items.length} configuration value{items.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((cfg) => {
              const k = `${cfg.module}.${cfg.key}`;
              return (
                <div key={cfg.id} className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-sm">{cfg.key}</Label>
                    {cfg.description && <p className="text-xs text-muted-foreground">{cfg.description}</p>}
                    <Input
                      value={editValues[k] ?? ''}
                      onChange={(e) => setEditValues({ ...editValues, [k]: e.target.value })}
                      disabled={!canWrite}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{cfg.type}</Badge>
                    {canWrite && (
                      <Button size="sm" variant="ghost" onClick={() => saveConfig(cfg.module, cfg.key)} disabled={saving === k}>
                        {saving === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
