'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mail, MessageSquare, Send, Loader2, Users, Upload, Image as ImageIcon, X } from 'lucide-react';

function parseExtraRecipients(text: string): string[] {
  return Array.from(new Set(text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)));
}

interface Audience {
  emailConsented: number;
  smsConsented: number;
  totalCustomers: number;
}

interface CampaignHistoryRow {
  id: string;
  createdAt: string;
  sentBy: string | null;
  channel: 'EMAIL' | 'SMS';
  subject: string | null;
  preview: string;
  audienceSize: number;
  sent: number;
  failed: number;
  flyerUrl?: string | null;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CampaignsPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const canSend = hasPermission('notifications:settings:write');
  const canView = hasPermission('notifications:settings:read');

  const [audience, setAudience] = useState<Audience | null>(null);
  const [history, setHistory] = useState<CampaignHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [channel, setChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [testAddress, setTestAddress] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingLive, setSendingLive] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [extraText, setExtraText] = useState('');
  const [extraConsentChecked, setExtraConsentChecked] = useState(false);
  const [extraConsentNote, setExtraConsentNote] = useState('');
  const extraFileRef = useRef<HTMLInputElement>(null);
  const extraList = parseExtraRecipients(extraText);

  const [flyerUrl, setFlyerUrl] = useState('');
  const [flyerUploading, setFlyerUploading] = useState(false);
  const flyerFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch('/api/v1/marketing/audience', { credentials: 'include', headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => setAudience(json.data ?? null))
      .catch(() => {});
    setLoadingHistory(true);
    fetch('/api/v1/marketing/campaigns', { credentials: 'include', headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => setHistory(json.data?.campaigns ?? []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const audienceCount = channel === 'EMAIL' ? audience?.emailConsented ?? 0 : audience?.smsConsented ?? 0;
  const canSubmit = message.trim().length > 0 && (channel === 'SMS' || subject.trim().length > 0);

  const onExtraFilePicked = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    setExtraText((prev) => (prev ? `${prev}\n${text}` : text));
  };

  const onFlyerPicked = async (file?: File) => {
    if (!file) return;
    setFlyerUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'marketing');
      const res = await fetch('/api/v1/media/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': authHeaders()['x-csrf-token'] },
        body: form,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setFlyerUrl(json.data.url);
    } catch (e) {
      toast.error((e as Error).message || 'Flyer upload failed');
    } finally {
      setFlyerUploading(false);
      if (flyerFileRef.current) flyerFileRef.current.value = '';
    }
  };

  const extraValid = () => {
    if (extraList.length === 0) return true;
    if (!extraConsentChecked) { toast.error('Confirm the additional recipients have consented before sending to them'); return false; }
    if (!extraConsentNote.trim()) { toast.error('Note how/where the additional recipients gave consent'); return false; }
    return true;
  };

  const sendTest = async () => {
    if (!testAddress.trim()) return toast.error(channel === 'EMAIL' ? 'Enter a test email address' : 'Enter a test phone number');
    if (!canSubmit) return toast.error('Write a message first');
    setSendingTest(true);
    try {
      const res = await fetch('/api/v1/marketing/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({
          channel,
          subject: channel === 'EMAIL' ? subject : undefined,
          message,
          flyerUrl: channel === 'EMAIL' ? flyerUrl || undefined : undefined,
          test: channel === 'EMAIL' ? { email: testAddress } : { phone: testAddress },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success('Test sent — check the inbox/phone');
    } catch (e) {
      toast.error((e as Error).message || 'Test send failed');
    } finally {
      setSendingTest(false);
    }
  };

  const openConfirm = () => {
    if (!extraValid()) return;
    setConfirmOpen(true);
  };

  const sendLive = async () => {
    setConfirmOpen(false);
    setSendingLive(true);
    try {
      const res = await fetch('/api/v1/marketing/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({
          channel,
          subject: channel === 'EMAIL' ? subject : undefined,
          message,
          flyerUrl: channel === 'EMAIL' ? flyerUrl || undefined : undefined,
          extraRecipients: extraList.length ? extraList : undefined,
          extraConsentNote: extraList.length ? extraConsentNote : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      const extra = json.data.extra as { requested: number; sent: number; suppressed: number; invalid: number } | null;
      let msg = `Sent to ${json.data.sent} of ${json.data.audienceSize} recipient${json.data.audienceSize === 1 ? '' : 's'}${json.data.failed ? ` (${json.data.failed} failed)` : ''}`;
      if (extra && extra.requested > 0) {
        msg += ` — including ${extra.sent} additional`;
        if (extra.suppressed) msg += `, ${extra.suppressed} skipped (previously unsubscribed)`;
        if (extra.invalid) msg += `, ${extra.invalid} invalid`;
      }
      toast.success(msg);
      setSubject('');
      setMessage('');
      setFlyerUrl('');
      setExtraText('');
      setExtraConsentChecked(false);
      setExtraConsentNote('');
      load();
    } catch (e) {
      toast.error((e as Error).message || 'Send failed');
    } finally {
      setSendingLive(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don&apos;t have permission to view marketing campaigns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground mt-1">
          Send an email or text message to customers who&apos;ve opted in to marketing — everyone else is automatically excluded.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Compose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={channel} onValueChange={(v) => setChannel(v as 'EMAIL' | 'SMS')}>
              <TabsList>
                <TabsTrigger value="EMAIL"><Mail className="h-3.5 w-3.5 mr-1.5" />Email</TabsTrigger>
                <TabsTrigger value="SMS"><MessageSquare className="h-3.5 w-3.5 mr-1.5" />SMS</TabsTrigger>
              </TabsList>

              <TabsContent value="EMAIL" className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="This weekend only: 20% off" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Message</Label>
                  <Textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your email — line breaks become paragraphs. An unsubscribe link is added automatically." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Flyer image (optional)</Label>
                  <input
                    ref={flyerFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => onFlyerPicked(e.target.files?.[0])}
                  />
                  {flyerUrl ? (
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={flyerUrl} alt="Flyer preview" className="max-h-40 rounded-md border" />
                      <button
                        type="button"
                        onClick={() => setFlyerUrl('')}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border flex items-center justify-center shadow-sm hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" disabled={flyerUploading} onClick={() => flyerFileRef.current?.click()}>
                      {flyerUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ImageIcon className="h-3.5 w-3.5 mr-1.5" />}
                      {flyerUploading ? 'Uploading…' : 'Add flyer image'}
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">Shown at the top of the email. JPG, PNG, WEBP or GIF.</p>
                </div>
              </TabsContent>

              <TabsContent value="SMS" className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Message</Label>
                  <Textarea rows={4} maxLength={480} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="20% off this weekend at The Steak Sheikh — order at thesteaksheikh.com" />
                  <p className="text-[11px] text-muted-foreground">{message.length}/480 — &quot;Reply STOP to opt out&quot; is added automatically.</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="rounded-md bg-muted/60 p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {audience ? (
                <span>
                  This will send to <span className="font-semibold text-foreground">{audienceCount}</span> customer{audienceCount === 1 ? '' : 's'} who opted in to marketing {channel === 'EMAIL' ? 'emails' : 'texts'}{extraList.length > 0 ? <> + up to <span className="font-semibold text-foreground">{extraList.length}</span> additional {extraList.length === 1 ? 'recipient' : 'recipients'} below</> : null}.
                </span>
              ) : (
                <span>Loading audience…</span>
              )}
            </div>

            <div className="space-y-2 rounded-md border border-border/60 p-3">
              <Label className="text-xs">
                Additional {channel === 'EMAIL' ? 'emails' : 'phone numbers'} (not in your customer list)
              </Label>
              <input
                ref={extraFileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => onExtraFilePicked(e.target.files?.[0])}
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => extraFileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload file
                </Button>
                {extraList.length > 0 && <span className="text-[11px] text-muted-foreground">{extraList.length} detected</span>}
              </div>
              <Textarea
                rows={3}
                value={extraText}
                onChange={(e) => setExtraText(e.target.value)}
                placeholder={channel === 'EMAIL' ? 'jane@example.com, another@example.com\n(one per line or comma-separated)' : '+447700900000, +447700900001'}
                className="font-mono text-xs"
              />
              {extraList.length > 0 && (
                <>
                  <div className="flex items-start gap-2">
                    <Checkbox id="extraConsent" className="mt-0.5" checked={extraConsentChecked} onCheckedChange={(v) => setExtraConsentChecked(v === true)} />
                    <Label htmlFor="extraConsent" className="text-xs font-normal leading-snug">
                      I confirm these {extraList.length} {channel === 'EMAIL' ? 'email addresses' : 'phone numbers'} have consented to receive marketing {channel === 'EMAIL' ? 'emails' : 'texts'} from us — they won&apos;t be saved as customers or included in future campaigns automatically.
                    </Label>
                  </div>
                  <Input
                    value={extraConsentNote}
                    onChange={(e) => setExtraConsentNote(e.target.value)}
                    placeholder="Where/how did they consent? e.g. Event sign-up sheet, Jun 2026"
                    className="text-xs"
                  />
                </>
              )}
              <p className="text-[11px] text-muted-foreground">
                Anyone here who previously unsubscribed is automatically skipped — an ad-hoc add can&apos;t override an opt-out.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <div className="flex-1 flex gap-2">
                <Input
                  value={testAddress}
                  onChange={(e) => setTestAddress(e.target.value)}
                  placeholder={channel === 'EMAIL' ? 'you@example.com' : '+447…'}
                  className="flex-1"
                />
                <Button variant="outline" disabled={!canSend || sendingTest} onClick={sendTest}>
                  {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send test'}
                </Button>
              </div>
              <Button disabled={!canSend || !canSubmit || sendingLive || (audienceCount === 0 && extraList.length === 0)} onClick={openConfirm}>
                {sendingLive ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
                Send{extraList.length > 0 ? '' : ` to ${audienceCount}`}
              </Button>
            </div>
            {!canSend && (
              <p className="text-[11px] text-muted-foreground">You can view campaigns but don&apos;t have permission to send them.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent sends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingHistory ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaigns sent yet.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="rounded-md border border-border/60 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {h.channel === 'EMAIL' ? <Mail className="h-3 w-3 mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                      {h.channel}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{fmtDate(h.createdAt)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    {h.flyerUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.flyerUrl} alt="" className="h-10 w-10 rounded object-cover border shrink-0" />
                    )}
                    <div className="min-w-0">
                      {h.subject && <p className="text-sm font-medium truncate">{h.subject}</p>}
                      <p className="text-xs text-muted-foreground truncate">{h.preview}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {h.sent}/{h.audienceSize} delivered{h.failed ? `, ${h.failed} failed` : ''}
                    {h.sentBy ? ` — ${h.sentBy}` : ''}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this {channel === 'EMAIL' ? 'email' : 'text'} now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately message {audienceCount} customer{audienceCount === 1 ? '' : 's'} who opted in to marketing {channel === 'EMAIL' ? 'emails' : 'texts'}
              {extraList.length > 0 ? ` plus up to ${extraList.length} additional recipient${extraList.length === 1 ? '' : 's'} you added` : ''}. This can&apos;t be undone or recalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={sendLive}>Send now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
