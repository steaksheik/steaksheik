'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, ShieldCheck, UserPlus, Pencil, KeyRound, UserX, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface RoleRef {
  id?: string;
  name?: string;
  displayName?: string;
}
interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: RoleRef[];
}
interface RoleInfo {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}
interface PermissionDef {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

/** One-click starting points for the job roles this kitchen actually has —
 *  tweak permissions before creating, or use as-is. */
const ROLE_PRESETS: { name: string; description: string; keys: string[] }[] = [
  {
    name: 'Kitchen Staff',
    description: 'Sees incoming orders and manages kitchen prep status.',
    keys: ['kitchen:queue:read', 'kitchen:queue:write', 'kitchen:settings:read', 'ordering:orders:read'],
  },
  {
    name: 'Dispatch Staff',
    description: 'Sees orders ready for delivery, updates dispatch status and views delivery contacts.',
    keys: ['ordering:orders:read', 'ordering:orders:write', 'ordering:customers:read'],
  },
  {
    name: 'Marketing Team',
    description: 'Manages branding, homepage content and views analytics.',
    keys: [
      'branding:brand:read', 'branding:brand:write', 'branding:theme:read', 'branding:theme:write',
      'branding:assets:write', 'theme_content:homepage:read', 'theme_content:homepage:write',
      'theme_content:navigation:read', 'theme_content:navigation:write', 'theme_content:seo:read',
      'theme_content:seo:write', 'theme_content:contact:read', 'theme_content:contact:write',
      'analytics:dashboard:read', 'analytics:reports:read', 'notifications:settings:read',
    ],
  },
  {
    name: 'Menu Manager',
    description: 'Full control over categories and products.',
    keys: [
      'catalogue:categories:read', 'catalogue:categories:write', 'catalogue:categories:delete',
      'catalogue:products:read', 'catalogue:products:write', 'catalogue:products:delete',
    ],
  },
];

export default function UsersPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [grouped, setGrouped] = useState<Record<string, PermissionDef[]>>({});
  const [loading, setLoading] = useState(true);

  const canWriteUsers = hasPermission('identity:users:write');
  const canDeleteUsers = hasPermission('identity:users:delete');
  const canWriteRoles = hasPermission('identity:roles:write');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/v1/users', { credentials: 'include', headers: authHeaders() }).then((r) => r.json()),
      fetch('/api/v1/roles', { credentials: 'include', headers: authHeaders() }).then((r) => r.json()),
      fetch('/api/v1/permissions', { credentials: 'include', headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([u, r, p]) => {
        setUsers(u.data?.users ?? []);
        setRoles(r.data?.roles ?? []);
        setPermissions(p.data?.permissions ?? []);
        setGrouped(p.data?.grouped ?? {});
      })
      .catch(() => toast.error('Failed to load users & roles'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Add user ──
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [userRoleIds, setUserRoleIds] = useState<Set<string>>(new Set());
  const [savingUser, setSavingUser] = useState(false);

  const openAddUser = () => {
    setUserForm({ email: '', password: '', firstName: '', lastName: '' });
    setUserRoleIds(new Set());
    setAddUserOpen(true);
  };

  const createUser = async () => {
    if (!userForm.email.trim() || !userForm.password || !userForm.firstName.trim() || !userForm.lastName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (userForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSavingUser(true);
    try {
      const res = await fetch('/api/v1/users', {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userForm, roleIds: Array.from(userRoleIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('User created');
        setAddUserOpen(false);
        load();
      } else {
        toast.error(data.error?.message ?? 'Failed to create user');
      }
    } catch {
      toast.error('Network error while creating user');
    } finally {
      setSavingUser(false);
    }
  };

  // ── Manage an existing user's role assignments ──
  const [manageUser, setManageUser] = useState<UserInfo | null>(null);
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);

  const toggleUserRole = async (roleId: string, assign: boolean) => {
    if (!manageUser) return;
    setTogglingRoleId(roleId);
    try {
      const res = assign
        ? await fetch(`/api/v1/users/${manageUser.id}/roles`, {
            method: 'POST',
            credentials: 'include',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleId }),
          })
        : await fetch(`/api/v1/users/${manageUser.id}/roles/${roleId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: authHeaders(),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error?.message ?? 'Failed to update role');
        return;
      }
      const role = roles.find((r) => r.id === roleId);
      const updateRoles = (list: RoleRef[]) =>
        assign
          ? [...list, { id: roleId, name: role?.name, displayName: role?.name }]
          : list.filter((r) => r.id !== roleId);
      setUsers((prev) => prev.map((u) => (u.id === manageUser.id ? { ...u, roles: updateRoles(u.roles) } : u)));
      setManageUser((prev) => (prev ? { ...prev, roles: updateRoles(prev.roles) } : prev));
    } catch {
      toast.error('Network error updating role');
    } finally {
      setTogglingRoleId(null);
    }
  };

  // ── Deactivate / reactivate a user (soft delete — status flips to INACTIVE) ──
  const [statusChanging, setStatusChanging] = useState(false);

  const toggleUserStatus = async () => {
    if (!manageUser) return;
    const deactivating = manageUser.status === 'ACTIVE';
    setStatusChanging(true);
    try {
      const res = deactivating
        ? await fetch(`/api/v1/users/${manageUser.id}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: authHeaders(),
          })
        : await fetch(`/api/v1/users/${manageUser.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACTIVE' }),
          });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to update user status');
        return;
      }
      const nextStatus = deactivating ? 'INACTIVE' : 'ACTIVE';
      toast.success(deactivating ? 'User deactivated' : 'User reactivated');
      setUsers((prev) => prev.map((u) => (u.id === manageUser.id ? { ...u, status: nextStatus } : u)));
      setManageUser((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    } catch {
      toast.error('Network error updating user status');
    } finally {
      setStatusChanging(false);
    }
  };

  // ── Admin-initiated password reset for the managed user ──
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const resetPassword = async () => {
    if (!manageUser) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch(`/api/v1/users/${manageUser.id}/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Password reset. ${manageUser.firstName} will need to sign in again.`);
        setResetPasswordOpen(false);
        setNewPassword('');
      } else {
        toast.error(data.error?.message ?? 'Failed to reset password');
      }
    } catch {
      toast.error('Network error while resetting password');
    } finally {
      setResettingPassword(false);
    }
  };

  // ── Add role ──
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [rolePermIds, setRolePermIds] = useState<Set<string>>(new Set());
  const [savingRole, setSavingRole] = useState(false);

  const openAddRole = () => {
    setRoleForm({ name: '', description: '' });
    setRolePermIds(new Set());
    setAddRoleOpen(true);
  };

  const applyPreset = (preset: (typeof ROLE_PRESETS)[number]) => {
    setRoleForm({ name: preset.name, description: preset.description });
    const ids = permissions.filter((p) => preset.keys.includes(p.key)).map((p) => p.id);
    setRolePermIds(new Set(ids));
  };

  const createRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error('Please enter a role name');
      return;
    }
    setSavingRole(true);
    try {
      const res = await fetch('/api/v1/roles', {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || undefined,
          permissionIds: Array.from(rolePermIds),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Role created');
        setAddRoleOpen(false);
        load();
      } else {
        toast.error(data.error?.message ?? 'Failed to create role');
      }
    } catch {
      toast.error('Network error while creating role');
    } finally {
      setSavingRole(false);
    }
  };

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
        <p className="text-muted-foreground mt-1">Manage platform users, roles and permissions.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'users' | 'roles')}>
        <TabsList>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 pt-4">
          <div className="flex justify-end">
            {canWriteUsers && (
              <Button size="sm" onClick={openAddUser}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Add User
              </Button>
            )}
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
                        <Badge key={r.id ?? r.name} variant="secondary" className="text-xs">
                          {r.displayName ?? r.name}
                        </Badge>
                      ))}
                      <Badge variant={u.status === 'ACTIVE' ? 'default' : 'destructive'} className="text-xs">
                        {u.status}
                      </Badge>
                      {canWriteUsers && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setManageUser(u);
                            setNewPassword('');
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">No users found.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4 pt-4">
          <div className="flex justify-end">
            {canWriteRoles && (
              <Button size="sm" onClick={openAddRole}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Role
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <Card key={r.id} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {r.name}
                    {r.isSystem && (
                      <Badge variant="outline" className="text-[10px]">
                        System
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">{r.description || 'No description'}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.userCount} user{r.userCount === 1 ? '' : 's'} &middot; {r.permissions.length} permission
                    {r.permissions.length === 1 ? '' : 's'}
                  </p>
                </CardContent>
              </Card>
            ))}
            {roles.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-8">No roles found.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add User dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new admin/staff account and assign roles.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name</Label>
                <Input value={userForm.firstName} onChange={(e) => setUserForm((p) => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Name</Label>
                <Input value={userForm.lastName} onChange={(e) => setUserForm((p) => ({ ...p, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Min. 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Roles</Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border rounded-md p-2">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={userRoleIds.has(r.id)}
                      onCheckedChange={(v) =>
                        setUserRoleIds((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        })
                      }
                    />
                    {r.name}
                  </label>
                ))}
                {roles.length === 0 && (
                  <p className="text-xs text-muted-foreground">No roles yet — create one in the Roles tab first.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createUser} disabled={savingUser}>
              {savingUser && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage user roles dialog */}
      <Dialog open={!!manageUser} onOpenChange={(o) => !o && setManageUser(null)}>
        <DialogContent className="sm:max-w-md">
          {manageUser && (
            <>
              <DialogHeader>
                <DialogTitle>{manageUser.firstName} {manageUser.lastName}</DialogTitle>
                <DialogDescription>{manageUser.email} — toggle role assignments below.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 py-2 max-h-64 overflow-y-auto">
                {roles.map((r) => {
                  const assigned = manageUser.roles.some((ur) => ur.id === r.id);
                  return (
                    <label key={r.id} className="flex items-center justify-between gap-2 text-sm rounded-md border p-2.5">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.description || `${r.permissions.length} permissions`}</p>
                      </div>
                      <Checkbox
                        checked={assigned}
                        disabled={togglingRoleId === r.id}
                        onCheckedChange={(v) => toggleUserRole(r.id, Boolean(v))}
                      />
                    </label>
                  );
                })}
                {roles.length === 0 && <p className="text-xs text-muted-foreground">No roles yet.</p>}
              </div>
              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setResetPasswordOpen(true)}>
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    Reset Password
                  </Button>
                  {canDeleteUsers && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={manageUser.status === 'ACTIVE' ? 'text-destructive hover:text-destructive' : ''}
                      onClick={toggleUserStatus}
                      disabled={statusChanging}
                    >
                      {statusChanging ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : manageUser.status === 'ACTIVE' ? (
                        <UserX className="h-3.5 w-3.5 mr-1.5" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {manageUser.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  )}
                </div>
                <Button variant="outline" onClick={() => setManageUser(null)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {manageUser?.firstName} {manageUser?.lastName}. They'll be signed out of any
              active sessions and need to sign in again with it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button onClick={resetPassword} disabled={resettingPassword}>
              {resettingPassword && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Set New Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Role dialog */}
      <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
            <DialogDescription>Define a role and pick which permissions it grants.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Quick presets</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_PRESETS.map((p) => (
                  <Button key={p.name} type="button" size="sm" variant="secondary" onClick={() => applyPreset(p)}>
                    {p.name}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Fills in a name, description and permission set — tweak before creating.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Kitchen Staff" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-3">
              <Label className="text-xs">Permissions ({rolePermIds.size} selected)</Label>
              {Object.entries(grouped).map(([mod, perms]) => (
                <div key={mod} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{mod}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={rolePermIds.has(p.id)}
                          onCheckedChange={(v) =>
                            setRolePermIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            })
                          }
                        />
                        <span className="truncate" title={p.description ?? p.key}>
                          {p.key}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {permissions.length === 0 && <p className="text-xs text-muted-foreground">No permissions catalog found.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createRole} disabled={savingRole}>
              {savingRole && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
