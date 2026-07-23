'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from '../layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  user: { firstName: string; lastName: string; email: string } | null;
  createdAt: string;
  ipAddress: string | null;
}

export default function AuditPage() {
  const { authHeaders } = useAdmin();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/audit-logs?limit=50', { credentials: 'include', headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setLogs(data.data?.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authHeaders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">Track all administrative actions across the platform.</p>
      </div>
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">{log.action}</Badge>
                    <span className="text-sm font-medium truncate">{log.resource}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                    {log.ipAddress ? ` • ${log.ipAddress}` : ''}
                  </p>
                </div>
                <time className="text-xs text-muted-foreground shrink-0">
                  {new Date(log.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })}
                </time>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No audit logs yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
