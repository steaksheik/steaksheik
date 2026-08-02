'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Search } from 'lucide-react';

interface Subscriber {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  marketingEmailConsent: boolean;
}

export default function NewsletterPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canRead = hasPermission('ordering:customers:read');

  const load = useCallback(async () => {
    if (!canRead) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/customers?source=newsletter', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setSubscribers(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [canRead, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? subscribers.filter(s =>
        (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.firstName || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.lastName || '').toLowerCase().includes(search.toLowerCase())
      )
    : subscribers;

  if (!canRead) {
    return <div className="p-6 text-muted-foreground">You don&apos;t have permission to view newsletter subscribers.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Newsletter Subscribers</h1>
          <p className="text-muted-foreground text-sm">People who signed up via the homepage newsletter form</p>
        </div>
        <Badge variant="secondary">{subscribers.length} subscribed</Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search subscribers..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{search ? 'No matching subscribers' : 'No newsletter signups yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Subscriber List</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {filtered.map(s => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm">
                      {s.firstName || s.lastName ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : <span className="text-muted-foreground italic">No name</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
