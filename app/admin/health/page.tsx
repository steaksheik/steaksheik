'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HealthData {
  status: string;
  database: string;
  uptime: number;
  timestamp: string;
  version: string;
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch('/api/v1/health')
      .then((r) => r.json())
      .then((data) => setHealth(data.data ?? null))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const items = [
    { label: 'Application', status: health?.status ?? 'unknown' },
    { label: 'Database', status: health?.database ?? 'unknown' },
    { label: 'Storage (S3)', status: 'pending' },
    { label: 'Email (SES)', status: 'pending' },
    { label: 'SMS (Twilio)', status: 'pending' },
    { label: 'Payments (Stripe)', status: 'pending' },
    { label: 'Analytics', status: 'pending' },
    { label: 'Background Jobs', status: 'pending' },
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
              {item.status === 'ok' || item.status === 'healthy' ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : item.status === 'pending' ? (
                <div className="h-4 w-4 rounded-full bg-muted-foreground/20" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <Badge variant={item.status === 'ok' || item.status === 'healthy' ? 'default' : 'secondary'}>
                {item.status === 'pending' ? 'Not configured' : item.status}
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
                <p className="text-muted-foreground">Uptime</p>
                <p className="font-medium">{Math.floor((health.uptime ?? 0) / 3600)}h {Math.floor(((health.uptime ?? 0) % 3600) / 60)}m</p>
              </div>
              <div>
                <p className="text-muted-foreground">Version</p>
                <p className="font-medium">{health.version ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Check</p>
                <p className="font-medium">{health.timestamp ? new Date(health.timestamp).toLocaleString('en-GB', { timeZone: 'UTC' }) : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
