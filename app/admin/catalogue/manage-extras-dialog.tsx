'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';

interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  sortOrder: number;
  isDefault: boolean;
  isAvailable: boolean;
}

interface ModifierGroupData {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  modifiers: ModifierOption[];
}

function apiErrorMessage(data: { error?: { message?: string; details?: { path?: string; message?: string }[] } }): string {
  const base = data.error?.message ?? 'Failed';
  const details = data.error?.details;
  if (!details?.length) return base;
  return `${base}: ${details.map((d) => (d.path ? `${d.path} — ${d.message}` : d.message)).join('; ')}`;
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

export function ManageExtrasDialog({
  open,
  onOpenChange,
  productId,
  productName,
  authHeaders,
  canWrite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  productName: string;
  authHeaders: () => Record<string, string>;
  canWrite: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ModifierGroupData[]>([]);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/catalogue/products/${productId}`, { credentials: 'include', headers: authHeaders() });
      const data = await res.json();
      setGroups(data.data?.product?.modifierGroups ?? []);
    } catch {
      toast.error('Failed to load extras');
    } finally {
      setLoading(false);
    }
  }, [productId, authHeaders]);

  useEffect(() => {
    if (open && productId) load();
  }, [open, productId, load]);

  // ── Add group ──
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', isRequired: false, minSelect: 0, maxSelect: 1 });
  const [savingGroup, setSavingGroup] = useState(false);

  async function createGroup() {
    if (!productId || !newGroup.name.trim()) return toast.error('Enter a group name');
    setSavingGroup(true);
    try {
      const res = await fetch(`/api/v1/catalogue/products/${productId}/modifiers`, {
        method: 'POST', credentials: 'include', headers: authHeaders(),
        body: JSON.stringify({ ...newGroup, description: newGroup.description || null, modifiers: [] }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(apiErrorMessage(data));
      toast.success('Group added');
      setNewGroup({ name: '', description: '', isRequired: false, minSelect: 0, maxSelect: 1 });
      setAddGroupOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to add group');
    } finally {
      setSavingGroup(false);
    }
  }

  // ── Edit group ──
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroup, setEditGroup] = useState({ name: '', description: '', isRequired: false, minSelect: 0, maxSelect: 1 });

  function startEditGroup(g: ModifierGroupData) {
    setEditingGroupId(g.id);
    setEditGroup({ name: g.name, description: g.description ?? '', isRequired: g.isRequired, minSelect: g.minSelect, maxSelect: g.maxSelect });
  }

  async function saveGroup(groupId: string) {
    if (!productId || !editGroup.name.trim()) return toast.error('Enter a group name');
    try {
      const res = await fetch(`/api/v1/catalogue/products/${productId}/modifiers/${groupId}`, {
        method: 'PUT', credentials: 'include', headers: authHeaders(),
        body: JSON.stringify({ ...editGroup, description: editGroup.description || null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(apiErrorMessage(data));
      toast.success('Group updated');
      setEditingGroupId(null);
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update group');
    }
  }

  async function deleteGroup(groupId: string, name: string) {
    if (!productId) return;
    if (!confirm(`Delete "${name}" and all its options? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/v1/catalogue/products/${productId}/modifiers/${groupId}`, {
        method: 'DELETE', credentials: 'include', headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed');
      toast.success('Group deleted');
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete group');
    }
  }

  // ── Add option ──
  const [addOptionFor, setAddOptionFor] = useState<string | null>(null);
  const [newOption, setNewOption] = useState({ name: '', price: '' });
  const [savingOption, setSavingOption] = useState(false);

  async function createOption(groupId: string) {
    if (!productId || !newOption.name.trim()) return toast.error('Enter an option name');
    const price = newOption.price.trim() ? Number(newOption.price) : 0;
    if (!Number.isFinite(price)) return toast.error('Enter a valid price adjustment');
    setSavingOption(true);
    try {
      const res = await fetch(`/api/v1/catalogue/products/${productId}/modifiers/${groupId}/options`, {
        method: 'POST', credentials: 'include', headers: authHeaders(),
        body: JSON.stringify({ name: newOption.name, priceAdjustment: price }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(apiErrorMessage(data));
      toast.success('Option added');
      setNewOption({ name: '', price: '' });
      setAddOptionFor(null);
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to add option');
    } finally {
      setSavingOption(false);
    }
  }

  // ── Edit option ──
  const [editingOption, setEditingOption] = useState<{ groupId: string; modifierId: string } | null>(null);
  const [editOption, setEditOption] = useState({ name: '', price: '' });

  function startEditOption(groupId: string, m: ModifierOption) {
    setEditingOption({ groupId, modifierId: m.id });
    setEditOption({ name: m.name, price: String(m.priceAdjustment) });
  }

  async function saveOption() {
    if (!productId || !editingOption || !editOption.name.trim()) return toast.error('Enter an option name');
    const price = Number(editOption.price);
    if (!Number.isFinite(price)) return toast.error('Enter a valid price adjustment');
    try {
      const res = await fetch(
        `/api/v1/catalogue/products/${productId}/modifiers/${editingOption.groupId}/options/${editingOption.modifierId}`,
        { method: 'PUT', credentials: 'include', headers: authHeaders(), body: JSON.stringify({ name: editOption.name, priceAdjustment: price }) }
      );
      const data = await res.json();
      if (!data.success) throw new Error(apiErrorMessage(data));
      toast.success('Option updated');
      setEditingOption(null);
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update option');
    }
  }

  async function deleteOption(groupId: string, modifierId: string, name: string) {
    if (!productId) return;
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/v1/catalogue/products/${productId}/modifiers/${groupId}/options/${modifierId}`, {
        method: 'DELETE', credentials: 'include', headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed');
      toast.success('Option deleted');
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete option');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extras — {productName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 py-2">
            {canWrite && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setAddGroupOpen((v) => !v)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Group
                </Button>
              </div>
            )}

            {addGroupOpen && (
              <Card className="shadow-sm border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Group name</Label>
                      <Input value={newGroup.name} onChange={(e) => setNewGroup((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Sauce Choice" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Min select</Label>
                      <Input type="number" min="0" value={newGroup.minSelect} onChange={(e) => setNewGroup((f) => ({ ...f, minSelect: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Max select</Label>
                      <Input type="number" min="1" value={newGroup.maxSelect} onChange={(e) => setNewGroup((f) => ({ ...f, maxSelect: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={newGroup.isRequired} onCheckedChange={(v) => setNewGroup((f) => ({ ...f, isRequired: v }))} />
                    <Label className="text-xs font-normal">Required</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setAddGroupOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={createGroup} disabled={savingGroup}>
                      {savingGroup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create Group'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {groups.length === 0 && !addGroupOpen && (
              <p className="text-sm text-muted-foreground text-center py-8">No extras configured for this product yet.</p>
            )}

            {groups.map((g) => (
              <Card key={g.id} className="shadow-sm">
                <CardHeader className="pb-3">
                  {editingGroupId === g.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Input className="col-span-2" value={editGroup.name} onChange={(e) => setEditGroup((f) => ({ ...f, name: e.target.value }))} />
                        <div className="space-y-1">
                          <Label className="text-xs">Min select</Label>
                          <Input type="number" min="0" value={editGroup.minSelect} onChange={(e) => setEditGroup((f) => ({ ...f, minSelect: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Max select</Label>
                          <Input type="number" min="1" value={editGroup.maxSelect} onChange={(e) => setEditGroup((f) => ({ ...f, maxSelect: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch checked={editGroup.isRequired} onCheckedChange={(v) => setEditGroup((f) => ({ ...f, isRequired: v }))} />
                          <Label className="text-xs font-normal">Required</Label>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingGroupId(null)}><X className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => saveGroup(g.id)}><Check className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{g.name}</h4>
                        {g.isRequired && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                        <span className="text-[11px] text-muted-foreground">
                          {g.maxSelect === 1 ? 'Choose one' : `Choose up to ${g.maxSelect}`}
                        </span>
                      </div>
                      {canWrite && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditGroup(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteGroup(g.id, g.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Separator className="mb-2" />
                  {g.modifiers.length === 0 && <p className="text-xs text-muted-foreground py-1">No options yet.</p>}
                  {g.modifiers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 py-1">
                      {editingOption?.modifierId === m.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input className="h-8 text-sm" value={editOption.name} onChange={(e) => setEditOption((f) => ({ ...f, name: e.target.value }))} />
                          <Input className="h-8 text-sm w-24" type="number" step="0.01" value={editOption.price} onChange={(e) => setEditOption((f) => ({ ...f, price: e.target.value }))} />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingOption(null)}><X className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={saveOption}><Check className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm">{m.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{m.priceAdjustment > 0 ? `+${formatPrice(m.priceAdjustment)}` : 'Free'}</span>
                            {canWrite && (
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditOption(g.id, m)}><Pencil className="h-3 w-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteOption(g.id, m.id, m.name)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {canWrite && addOptionFor === g.id ? (
                    <div className="flex items-center gap-2 pt-2">
                      <Input className="h-8 text-sm" placeholder="Option name" value={newOption.name} onChange={(e) => setNewOption((f) => ({ ...f, name: e.target.value }))} />
                      <Input className="h-8 text-sm w-24" type="number" step="0.01" placeholder="0.00" value={newOption.price} onChange={(e) => setNewOption((f) => ({ ...f, price: e.target.value }))} />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAddOptionFor(null); setNewOption({ name: '', price: '' }); }}><X className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => createOption(g.id)} disabled={savingOption}>
                        {savingOption ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ) : canWrite ? (
                    <Button size="sm" variant="ghost" className="text-xs h-7 mt-1" onClick={() => setAddOptionFor(g.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Option
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
