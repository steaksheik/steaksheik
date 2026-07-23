'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users } from 'lucide-react';

interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: { role: { displayName: string } }[];
}

export default function UsersPage() {
  const { authHeaders } = useAdmin();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/users', { credentials: 'include', headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setUsers(data.data?.items ?? []))
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
        <h1 className="text-2xl font-display font-bold tracking-tight">Users & Roles</h1>
        <p className="text-muted-foreground mt-1">Manage platform users and their role assignments.</p>
      </div>
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.roles?.map((r) => (
                    <Badge key={r.role.displayName} variant="secondary" className="text-xs">
                      {r.role.displayName}
                    </Badge>
                  ))}
                  <Badge variant={u.status === 'ACTIVE' ? 'default' : 'destructive'} className="text-xs">
                    {u.status}
                  </Badge>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No users found.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
