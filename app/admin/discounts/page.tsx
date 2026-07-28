
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Trash2, Tag, RefreshCw } from 'lucide-react';

interface Discount {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  minSubtotal: number | null;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  maxRedemptionsPerCustomer: number | null;
  isActive: boolean;
  categoryId: string | null;
  productId: string | null;
  category: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
  _count: { redemptions: number };
}

interface Category { id: string; name: string; }
interface Product { id: string; name: string; }

/** Surface the failing field, not just the generic "Request validation failed". */
function apiErrorMessage(data: { error?: { message?: string; details?: { path?: string; message?: string }[] } }): string {
  const base = data.error?.message ?? 'Failed';
  const details = data.error?.details;
  if (!details?.length) return base;
  return `${base}: ${details.map((d) => (d.path ? `${d.path} — ${d.message}` : d.message)).join('; ')}`;
}

function formatValue(d: Discount): string {
  return d.type === 'PERCENTAGE' ? `${d.value}%` : `£${d.value.toFixed(2)}`;
}

function dateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export default function DiscountsPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [maxRedemptionsPerCustomer, setMaxRedemptionsPerCustomer] = useState('1');
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [saving, setSaving] = useState(false);

  const canWrite = hasPermission('discounts:codes:write');
  const canDelete = hasPermission('discounts:codes:delete');

  const load = useCallback(async () => {
    try {
      const [dRes, cRes, pRes] = await Promise.all([
        fetch('/api/v1/discounts?limit=100', { credentials: 'include', headers: authHeaders() }),
        fetch('/api/v1/catalogue/categories', { credentials: 'include', headers: authHeaders() }),
        fetch('/api/v1/catalogue/products?limit=200', { credentials: 'include', headers: authHeaders() }),
      ]);
      const [dData, cData, pData] = await Promise.all([dRes.json(), cRes.json(), pRes.json()]);
      setDiscounts(dData.data?.discounts ?? []);
      setCategories(cData.data?.categories ?? []);
      setProducts(pData.data?.products ?? []);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  function openDialog(d?: Discount) {
    setEditing(d ?? null);
    setCode(d?.code ?? '');
    setDescription(d?.description ?? '');
    setType(d?.type ?? 'PERCENTAGE');
    setValue(d ? String(d.value) : '');
    setMinSubtotal(d?.minSubtotal ? String(d.minSubtotal) : '');
    setMaxDiscountAmount(d?.maxDiscountAmount ? String(d.maxDiscountAmount) : '');
    setStartsAt(dateInputValue(d?.startsAt ?? null));
    setEndsAt(dateInputValue(d?.endsAt ?? null));
    setMaxRedemptions(d?.maxRedemptions ? String(d.maxRedemptions) : '');
    setMaxRedemptionsPerCustomer(d?.maxRedemptionsPerCustomer ? String(d.maxRedemptionsPerCustomer) : '1');
    setIsActive(d?.isActive ?? true);
    setCategoryId(d?.categoryId ?? '');
    setProductId(d?.productId ?? '');
    setDialogOpen(true);
  }

  async function save() {
    const numValue = parseFloat(value);
    if (!code.trim()) return toast.error('Enter a code');
    if (!Number.isFinite(numValue) || numValue <= 0) return toast.error('Enter a valid value greater than 0');
    if (type === 'PERCENTAGE' && numValue > 100) return toast.error('Percentage cannot exceed 100');

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: code.trim(),
        description: description.trim() || null,
        type,
        value: numValue,
        minSubtotal: minSubtotal.trim() ? parseFloat(minSubtotal) : null,
        maxDiscountAmount: maxDiscountAmount.trim() ? parseFloat(maxDiscountAmount) : null,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt + 'T23:59:59').toISOString() : null,
        maxRedemptions: maxRedemptions.trim() ? parseInt(maxRedemptions, 10) : null,
        maxRedemptionsPerCustomer: maxRedemptionsPerCustomer.trim() ? parseInt(maxRedemptionsPerCustomer, 10) : null,
        isActive,
        categoryId: categoryId || null,
        productId: productId || null,
      };
      const url = editing ? `/api/v1/discounts/${editing.id}` : '/api/v1/discounts';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editing ? 'Discount updated' : 'Discount created');
        setDialogOpen(false);
        load();
      } else {
        toast.error(apiErrorMessage(data));
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Discount) {
    try {
      const res = await fetch(`/api/v1/discounts/${d.id}`, {
        method: 'PUT', credentials: 'include', headers: authHeaders(),
        body: JSON.stringify({ isActive: !d.isActive }),
      });
      const data = await res.json();
      if (data.success) { toast.success(d.isActive ? 'Deactivated' : 'Activated'); load(); }
      else toast.error(apiErrorMessage(data));
    } catch { toast.error('Network error'); }
  }

  async function remove(d: Discount) {
    if (d._count.redemptions > 0) {
      return toast.error('This code has been used — deactivate it instead of deleting');
    }
    if (!confirm(`Delete code "${d.code}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/v1/discounts/${d.id}`, { method: 'DELETE', credentials: 'include', headers: authHeaders() });
      const data = await res.json();
      if (data.success) { toast.success('Discount deleted'); load(); }
      else toast.error(apiErrorMessage(data));
    } catch { toast.error('Network error'); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Discounts</h1>
          <p className="text-muted-foreground mt-1">Create coupon codes customers can enter at checkout.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1.5" />Refresh</Button>
          {canWrite && <Button size="sm" onClick={() => openDialog()}><Plus className="h-4 w-4 mr-1.5" />New Code</Button>}
        </div>
      </div>

      {discounts.length === 0 ? (
        <Card className="shadow-sm"><CardContent className="py-12 text-center text-muted-foreground">
          No discount codes yet. Create one to let customers apply it at checkout.
        </CardContent></Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y">
              {discounts.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-semibold truncate">{d.code}</p>
                      <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px]">
                        {d.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {d.product && <Badge variant="outline" className="text-[10px]">{d.product.name}</Badge>}
                      {d.category && <Badge variant="outline" className="text-[10px]">{d.category.name}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.description || 'No description'}
                      {(d.startsAt || d.endsAt) && (
                        <> • {d.startsAt ? new Date(d.startsAt).toLocaleDateString() : 'Any time'} – {d.endsAt ? new Date(d.endsAt).toLocaleDateString() : 'No end'}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatValue(d)}</p>
                    <p className="text-xs text-muted-foreground">
                      {d._count.redemptions}{d.maxRedemptions ? `/${d.maxRedemptions}` : ''} used
                    </p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    {canWrite && (
                      <Switch
                        checked={d.isActive}
                        onCheckedChange={() => toggleActive(d)}
                        className="scale-75 mx-1"
                        title={d.isActive ? 'Deactivate' : 'Activate'}
                      />
                    )}
                    {canWrite && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(d)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Discount Code' : 'New Discount Code'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WEEKEND10" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'PERCENTAGE' | 'FIXED_AMOUNT')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage off</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">Fixed amount off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Internal note, e.g. Weekend promo for socials" />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{type === 'PERCENTAGE' ? 'Percentage off (%)' : 'Amount off (£)'}</Label>
                <Input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'PERCENTAGE' ? '10' : '5.00'} />
              </div>
              <div className="space-y-2">
                <Label>Minimum spend (£)</Label>
                <Input type="number" step="0.01" min="0" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} placeholder="Optional" />
              </div>
              {type === 'PERCENTAGE' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Max discount cap (£)</Label>
                  <Input type="number" step="0.01" min="0" value={maxDiscountAmount} onChange={(e) => setMaxDiscountAmount(e.target.value)} placeholder="Optional — caps the % discount" />
                </div>
              )}
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Starts</Label>
                <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ends</Label>
                <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Total uses allowed</Label>
                <Input type="number" min="1" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="Unlimited" />
              </div>
              <div className="space-y-2">
                <Label>Uses per customer</Label>
                <Input type="number" min="1" value={maxRedemptionsPerCustomer} onChange={(e) => setMaxRedemptionsPerCustomer(e.target.value)} placeholder="Unlimited" />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Limit to category</Label>
                <Select value={categoryId || 'any'} onValueChange={(v) => setCategoryId(v === 'any' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Any category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any category</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Limit to product</Label>
                <Select value={productId || 'any'} onValueChange={(v) => setProductId(v === 'any' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Any product" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any product</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !code.trim() || !value}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
