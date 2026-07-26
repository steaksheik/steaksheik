'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Users, Search, Mail, MessageSquare, UserPlus, Upload } from 'lucide-react';

interface Customer {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  marketingEmailConsent: boolean;
  marketingSmsConsent: boolean;
  contactSource: string;
  _count: { orders: number };
}

export default function CustomersPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canRead = hasPermission('ordering:customers:read');
  const canWrite = hasPermission('ordering:customers:write');

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
        (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.firstName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.lastName || '').toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  // ── Add contact ──
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', emailConsent: false, smsConsent: false, consentNote: '' });

  const openAdd = () => {
    setForm({ firstName: '', lastName: '', email: '', phone: '', emailConsent: false, smsConsent: false, consentNote: '' });
    setAddOpen(true);
  };

  const submitAdd = async () => {
    if (!form.email.trim() && !form.phone.trim()) return toast.error('Enter an email address or phone number');
    if (form.emailConsent && !form.email.trim()) return toast.error('Email consent requires an email address');
    if (form.smsConsent && !form.phone.trim()) return toast.error('SMS consent requires a phone number');
    if ((form.emailConsent || form.smsConsent) && !form.consentNote.trim()) return toast.error('Note how/where this contact gave consent');
    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/customers', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          emailConsent: form.emailConsent,
          smsConsent: form.smsConsent,
          consentNote: form.consentNote || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success('Contact added');
      setAddOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  // ── CSV import ──
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [importEmailConsent, setImportEmailConsent] = useState(true);
  const [importSmsConsent, setImportSmsConsent] = useState(false);
  const [importNote, setImportNote] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openImport = () => {
    setCsvText('');
    setCsvFileName('');
    setImportEmailConsent(true);
    setImportSmsConsent(false);
    setImportNote('');
    setImportOpen(true);
  };

  const onFilePicked = async (file: File | undefined) => {
    if (!file) return;
    setCsvFileName(file.name);
    setCsvText(await file.text());
  };

  const submitImport = async () => {
    if (!csvText.trim()) return toast.error('Choose a CSV file or paste CSV content');
    if (!importEmailConsent && !importSmsConsent) return toast.error('Select at least one channel this list consented to');
    if (!importNote.trim()) return toast.error('Note where this list came from and how consent was obtained');
    setImporting(true);
    try {
      const res = await fetch('/api/v1/admin/customers/import', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ csv: csvText, emailConsent: importEmailConsent, smsConsent: importSmsConsent, consentNote: importNote }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      const { imported, updated, skipped } = json.data;
      toast.success(`Imported ${imported} new, updated ${updated}${skipped.length ? `, skipped ${skipped.length}` : ''}`);
      setImportOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (!canRead) {
    return <div className="p-6 text-muted-foreground">You don&apos;t have permission to view customers.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">Registered customers, plus any contacts added for marketing</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{customers.length} total</Badge>
          <Badge variant="outline" className="gap-1">
            <Mail className="h-3 w-3" /> {customers.filter(c => c.marketingEmailConsent).length} opted in
          </Badge>
          <Badge variant="outline" className="gap-1">
            <MessageSquare className="h-3 w-3" /> {customers.filter(c => c.marketingSmsConsent).length} opted in
          </Badge>
          {canWrite && (
            <>
              <Button size="sm" variant="outline" onClick={openImport}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Import CSV
              </Button>
              <Button size="sm" onClick={openAdd}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add Contact
              </Button>
            </>
          )}
        </div>
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
                    <p className="font-medium text-sm flex items-center gap-2">
                      {c.firstName || ''} {c.lastName || ''}
                      {!c.firstName && !c.lastName && <span className="text-muted-foreground italic">No name</span>}
                      {c.contactSource !== 'registered' && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          {c.contactSource === 'csv_import' ? 'Imported' : 'Manually added'}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.email || c.phone || '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{c._count.orders} orders</span>
                    <Mail className={`h-3.5 w-3.5 ${c.marketingEmailConsent ? 'text-emerald-500' : 'text-muted-foreground/30'}`}>
                      <title>{c.marketingEmailConsent ? 'Opted in to marketing email' : 'Not opted in to marketing email'}</title>
                    </Mail>
                    <MessageSquare className={`h-3.5 w-3.5 ${c.marketingSmsConsent ? 'text-emerald-500' : 'text-muted-foreground/30'}`}>
                      <title>{c.marketingSmsConsent ? 'Opted in to marketing SMS' : 'Not opted in to marketing SMS'}</title>
                    </MessageSquare>
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

      {/* Add contact */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add someone who isn&apos;t a registered customer — e.g. from a paper sign-up sheet — so they can receive campaigns. Only tick consent boxes for channels they&apos;ve actually agreed to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First name</Label>
                <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last name</Label>
                <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+44…" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ec" checked={form.emailConsent} onCheckedChange={(v) => setForm(f => ({ ...f, emailConsent: v === true }))} />
              <Label htmlFor="ec" className="text-xs font-normal">Consented to marketing emails</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sc" checked={form.smsConsent} onCheckedChange={(v) => setForm(f => ({ ...f, smsConsent: v === true }))} />
              <Label htmlFor="sc" className="text-xs font-normal">Consented to marketing texts</Label>
            </div>
            {(form.emailConsent || form.smsConsent) && (
              <div className="space-y-1.5">
                <Label className="text-xs">How/where did they consent?</Label>
                <Textarea rows={2} value={form.consentNote} onChange={e => setForm(f => ({ ...f, consentNote: e.target.value }))} placeholder="e.g. Signed up at till, 12 Jul 2026" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Contacts from CSV</DialogTitle>
            <DialogDescription>
              Columns: firstName, lastName, email, phone (header row required). This applies to everyone in the file, so only use it for a list you already have consent for.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onFilePicked(e.target.files?.[0])}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> {csvFileName || 'Choose CSV file'}
              </Button>
              <Textarea
                rows={4}
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); setCsvFileName(''); }}
                placeholder={'firstName,lastName,email,phone\nJane,Doe,jane@example.com,+447700900000'}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="iec" checked={importEmailConsent} onCheckedChange={(v) => setImportEmailConsent(v === true)} />
              <Label htmlFor="iec" className="text-xs font-normal">This list consented to marketing emails</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="isc" checked={importSmsConsent} onCheckedChange={(v) => setImportSmsConsent(v === true)} />
              <Label htmlFor="isc" className="text-xs font-normal">This list consented to marketing texts</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Where did this list come from, and how was consent obtained?</Label>
              <Textarea rows={2} value={importNote} onChange={e => setImportNote(e.target.value)} placeholder="e.g. In-store sign-up sheet, Jan–Jun 2026" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={submitImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
