'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Search } from 'lucide-react';

interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  _count: { orders: number };
}

export default function CustomersPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canRead = hasPermission('ordering:customers:read');

  const load = useCallback(async () => {
    if (!canRead) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/customers', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setCustomers(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [canRead, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? customers.filter(c =>
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        (c.firstName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.lastName || '').toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  if (!canRead) {
    return <div className="p-6 text-muted-foreground">You don&apos;t have permission to view customers.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage registered customers</p>
        </div>
        <Badge variant="secondary">{customers.length} total</Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{search ? 'No matching customers' : 'No customers registered yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Customer List</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {filtered.map(c => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm">
                      {c.firstName || ''} {c.lastName || ''}
                      {!c.firstName && !c.lastName && <span className="text-muted-foreground italic">No name</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{c._count.orders} orders</span>
                    <Badge variant={c.status === 'ACTIVE' ? 'default' : 'destructive'} className="text-[10px]">
                      {c.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
