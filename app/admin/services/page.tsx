'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings2,
  Plug,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { metaFor, type ServiceMeta } from '@/lib/plugins/service-fields';

interface ServiceInfo {
  serviceType: string;
  adapterId: string;
  adapterName: string;
  fallbackId: string;
  displayName: string;
  configured: boolean;
  isEnabled: boolean;
  status: string;
  lastHealthStatus?: { status?: string } | null;
}

function statusIcon(status: string) {
  if (status === 'CONNECTED') return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  if (status === 'CONFIGURED') return <AlertCircle className="h-4 w-4 text-amber-500" />;
  if (status === 'ERROR') return <XCircle className="h-4 w-4 text-red-500" />;
  return <XCircle className="h-4 w-4 text-muted-foreground" />;
}

export default function ServicesPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<{ svc: ServiceInfo; meta: ServiceMeta } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingDialog, setLoadingDialog] = useState(false);

  const canWrite = hasPermission('services:platform:write');
  const canTest = hasPermission('services:platform:test');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/services', { credentials: 'include', headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setServices(data.data?.services ?? []))
      .catch(() => toast.error('Failed to load services'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceInfo[]>();
    for (const svc of services) {
      const meta = metaFor(svc.serviceType);
      const cat = meta?.category ?? 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(svc);
    }
    return Array.from(map.entries());
  }, [services]);

  const openConfigure = useCallback(
    async (svc: ServiceInfo) => {
      const meta = metaFor(svc.serviceType);
      if (!meta) {
        toast.error('No configuration schema for this service');
        return;
      }
      setActive({ svc, meta });
      setForm({});
      setLoadingDialog(true);
      try {
        const res = await fetch(`/api/v1/services/${svc.serviceType}`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        const data = await res.json();
        const cfg = (data.data?.service?.config ?? {}) as Record<string, unknown>;
        // Prefill only non-secret config settings; credentials stay blank/masked.
        const initial: Record<string, string> = {};
        for (const f of meta.fields) {
          if (f.kind === 'config' && cfg[f.key] != null) initial[f.key] = String(cfg[f.key]);
        }
        setForm(initial);
      } catch {
        // ignore — start with empty form
      } finally {
        setLoadingDialog(false);
      }
    },
    [authHeaders]
  );

  const buildPayload = useCallback(() => {
    if (!active) return null;
    const credentials: Record<string, string> = {};
    const config: Record<string, string> = {};
    for (const f of active.meta.fields) {
      const val = form[f.key]?.trim();
      if (!val) continue;
      if (f.kind === 'credential') credentials[f.key] = val;
      else config[f.key] = val;
    }
    return { adapterType: active.svc.adapterId, displayName: active.meta.label, credentials, config };
  }, [active, form]);

  const validate = useCallback(() => {
    if (!active) return false;
    const missing = active.meta.fields.filter(
      (f) => f.required && f.kind === 'config' && !form[f.key]?.trim()
    );
    // Required credentials only enforced on first configure; on re-save allow
    // leaving secret fields blank to keep existing values.
    if (!active.svc.configured) {
      const missingCreds = active.meta.fields.filter(
        (f) => f.required && f.kind === 'credential' && !form[f.key]?.trim()
      );
      if (missingCreds.length) {
        toast.error(`Please fill: ${missingCreds.map((f) => f.label).join(', ')}`);
        return false;
      }
    }
    if (missing.length) {
      toast.error(`Please fill: ${missing.map((f) => f.label).join(', ')}`);
      return false;
    }
    return true;
  }, [active, form]);

  const save = useCallback(async () => {
    if (!active || !validate()) return;
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/services/${active.svc.serviceType}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${active.meta.label} configured`);
        setActive(null);
        load();
      } else {
        toast.error(data.error?.message ?? 'Failed to save configuration');
      }
    } catch {
      toast.error('Network error while saving');
    } finally {
      setSaving(false);
    }
  }, [active, authHeaders, buildPayload, load, validate]);

  const testConnection = useCallback(async () => {
    if (!active) return;
    setTesting(true);
    try {
      // Persist first so the adapter is reconfigured with the latest creds.
      if (canWrite) {
        const payload = buildPayload();
        if (payload && (Object.keys(payload.credentials).length || Object.keys(payload.config).length)) {
          await fetch(`/api/v1/services/${active.svc.serviceType}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      }
      const res = await fetch(`/api/v1/services/${active.svc.serviceType}/test`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        const t = data.data?.test;
        if (t?.success) toast.success(t.message ?? 'Connection successful');
        else toast.error(t?.message ?? 'Connection test failed');
        load();
      } else {
        toast.error(data.error?.message ?? 'Test failed');
      }
    } catch {
      toast.error('Network error during test');
    } finally {
      setTesting(false);
    }
  }, [active, authHeaders, buildPayload, canWrite, load]);

  const toggleEnabled = useCallback(
    async (svc: ServiceInfo, enabled: boolean) => {
      if (!svc.configured) {
        toast.error('Configure the service before enabling it');
        return;
      }
      setServices((prev) =>
        prev.map((s) => (s.serviceType === svc.serviceType ? { ...s, isEnabled: enabled } : s))
      );
      try {
        const res = await fetch(`/api/v1/services/${svc.serviceType}/toggle`, {
          method: 'POST',
          credentials: 'include',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error?.message ?? 'Failed to update');
          load();
        } else {
          toast.success(enabled ? 'Service enabled' : 'Service disabled');
        }
      } catch {
        toast.error('Network error');
        load();
      }
    },
    [authHeaders, load]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Platform Services</h1>
        <p className="text-muted-foreground mt-1">
          Connect third-party providers — storage, email, SMS, payments and more. Credentials are
          encrypted at rest and can be tested before going live.
        </p>
      </div>

      {grouped.map(([category, list]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((svc) => {
              const meta = metaFor(svc.serviceType);
              return (
                <Card key={svc.serviceType} className="shadow-sm flex flex-col">
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <div className="space-y-0.5">
                      <CardTitle className="text-sm font-semibold">
                        {meta?.label ?? svc.displayName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{meta?.provider ?? svc.adapterName}</p>
                    </div>
                    {statusIcon(svc.status)}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-4">
                    <p className="text-xs text-muted-foreground leading-relaxed min-h-[32px]">
                      {meta?.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={svc.configured ? 'default' : 'secondary'}>
                        {svc.configured ? 'Configured' : 'Not configured'}
                      </Badge>
                      {svc.status === 'CONNECTED' && (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                          Connected
                        </Badge>
                      )}
                      {svc.status === 'ERROR' && (
                        <Badge variant="outline" className="border-red-500/40 text-red-600">
                          Error
                        </Badge>
                      )}
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={svc.isEnabled}
                          disabled={!canWrite || !svc.configured}
                          onCheckedChange={(v) => toggleEnabled(svc, v)}
                          aria-label="Enable service"
                        />
                        <span className="text-xs text-muted-foreground">
                          {svc.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openConfigure(svc)}
                        disabled={!canWrite && !canTest}
                      >
                        <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                        Configure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plug className="h-4 w-4 text-primary" />
                  {active.meta.label}
                </DialogTitle>
                <DialogDescription>
                  {active.meta.provider} &middot; {active.meta.description}
                  {active.meta.docsUrl && (
                    <a
                      href={active.meta.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      dashboard <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </DialogDescription>
              </DialogHeader>

              {loadingDialog ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  {active.svc.configured && (
                    <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                      <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        This service is already configured. Leave secret fields blank to keep the
                        existing values, or enter new ones to replace them.
                      </span>
                    </div>
                  )}
                  {active.meta.fields.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label htmlFor={f.key} className="text-xs">
                        {f.label}
                        {f.required && <span className="text-red-500 ml-0.5">*</span>}
                        {f.secret && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            secret
                          </span>
                        )}
                      </Label>
                      <Input
                        id={f.key}
                        type={f.secret ? 'password' : 'text'}
                        autoComplete="off"
                        placeholder={
                          f.secret && active.svc.configured
                            ? '•••••••• (unchanged)'
                            : f.placeholder ?? ''
                        }
                        value={form[f.key] ?? ''}
                        disabled={!canWrite}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                      {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                {canTest && active.svc.configured && (
                  <Button variant="outline" onClick={testConnection} disabled={testing || saving}>
                    {testing ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Plug className="h-4 w-4 mr-1.5" />
                    )}
                    Test connection
                  </Button>
                )}
                {canWrite && (
                  <Button onClick={save} disabled={saving || testing}>
                    {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    Save configuration
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
