'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/lib/admin-auth-context';
import { metaFor } from '@/lib/plugins/service-fields';

interface HealthData {
  status: string;
  checks: {
    database: { status: string; latencyMs: number };
    cache: { status: string; backend: string };
    eventBus: { status: string; transport: string };
  };
}

interface ServiceInfo {
  serviceType: string;
  configured: boolean;
  status: string;
}

type ItemStatus = 'ok' | 'error' | 'pending' | 'unknown';

function badgeLabel(status: ItemStatus, raw: string): string {
  if (status === 'ok') return raw;
  if (status === 'error') return 'Error';
  if (status === 'pending') return 'Not configured';
  return raw;
}

export default function HealthPage() {
  const { authHeaders } = useAdmin();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/v1/health').then((r) => r.json()),
      fetch('/api/v1/services', { credentials: 'include', headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([healthRes, servicesRes]) => {
        setHealth(healthRes.data ?? null);
        setServices(servicesRes.data?.services ?? []);
        setLastChecked(new Date());
      })
      .catch(() => {
        setHealth(null);
        setServices([]);
      })
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  if (loading && !lastChecked) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items: { label: string; status: ItemStatus; raw: string }[] = [
    { label: 'Application', status: health?.status === 'ok' ? 'ok' : 'unknown', raw: health?.status ?? 'unknown' },
    { label: 'Database', status: health?.checks?.database?.status === 'up' ? 'ok' : 'unknown', raw: health?.checks?.database?.status ?? 'unknown' },
    ...services.map((s) => {
      const label = metaFor(s.serviceType)?.label ?? s.serviceType;
      const status: ItemStatus = s.status === 'CONNECTED' ? 'ok' : s.status === 'ERROR' ? 'error' : 'pending';
      return { label, status, raw: s.status };
    }),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground mt-1">Platform service status and diagnostics.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <Card key={item.label} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              {item.status === 'ok' ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : item.status === 'pending' ? (
                <div className="h-4 w-4 rounded-full bg-muted-foreground/20" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <Badge variant={item.status === 'ok' ? 'default' : 'secondary'}>
                {badgeLabel(item.status, item.raw)}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {health && (
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground">Database Latency</p>
                <p className="font-medium">{health.checks?.database?.latencyMs ?? 0}ms</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cache Backend</p>
                <p className="font-medium capitalize">{health.checks?.cache?.backend ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Check</p>
                <p className="font-medium">{lastChecked ? lastChecked.toLocaleString('en-GB', { timeZone: 'UTC' }) : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
