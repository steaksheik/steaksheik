'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ChevronDown, Mail, Phone, Trash2, Reply } from 'lucide-react';
import { toast } from 'sonner';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED';
  createdAt: string;
}

const STATUSES = ['NEW', 'READ', 'REPLIED', 'ARCHIVED'] as const;

const STATUS_COLOURS: Record<string, string> = {
  NEW: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  READ: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  REPLIED: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  ARCHIVED: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
}

export default function MessagesPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canWrite = hasPermission('support:messages:write');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter ? `/api/v1/contact?status=${filter}` : '/api/v1/contact';
      const res = await fetch(url, { credentials: 'include', headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setMessages(json.data.messages ?? []);
        setTotal(json.data.total ?? 0);
        setUnread(json.data.unread ?? 0);
      } else {
        toast.error(json.error?.message ?? 'Failed to load messages');
      }
    } catch {
      toast.error('Failed to load messages');
    }
    setLoading(false);
  }, [filter, authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(msg: ContactMessage, status: ContactMessage['status']) {
    setBusy(msg.id);
    try {
      const res = await fetch(`/api/v1/contact/${msg.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) { toast.success(`Marked as ${status.toLowerCase()}`); load(); }
      else toast.error(json.error?.message ?? 'Update failed');
    } catch {
      toast.error('Update failed');
    }
    setBusy(null);
  }

  async function remove(msg: ContactMessage) {
    if (!confirm(`Permanently delete the message from ${msg.name}? This cannot be undone.`)) return;
    setBusy(msg.id);
    try {
      const res = await fetch(`/api/v1/contact/${msg.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (json.success) { toast.success('Message deleted'); load(); }
      else toast.error(json.error?.message ?? 'Delete failed');
    } catch {
      toast.error('Delete failed');
    }
    setBusy(null);
  }

  /** Opening an unread message marks it read — no extra click needed. */
  function toggleExpand(msg: ContactMessage) {
    const opening = expanded !== msg.id;
    setExpanded(opening ? msg.id : null);
    if (opening && msg.status === 'NEW' && canWrite) setStatus(msg, 'READ');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {total} message{total === 1 ? '' : 's'}
            {unread > 0 && <> · <span className="text-amber-600 font-medium">{unread} unread</span></>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('')}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${!filter ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : messages.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No messages{filter ? ` with status ${filter}` : ''} yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const isOpen = expanded === msg.id;
            return (
              <Card key={msg.id} className="overflow-hidden">
                <button onClick={() => toggleExpand(msg)} className="w-full text-left">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${msg.status === 'NEW' ? 'font-bold' : 'font-medium'}`}>
                          {msg.subject || '(no subject)'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {msg.name} · {msg.email} · {fmtDate(msg.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={STATUS_COLOURS[msg.status]}>{msg.status}</Badge>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </CardHeader>
                </button>

                {isOpen && (
                  <CardContent className="px-4 pb-4 pt-0 border-t">
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        <a href={`mailto:${msg.email}`} className="hover:underline">{msg.email}</a>
                      </span>
                      {msg.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          <a href={`tel:${msg.phone.replace(/\s+/g, '')}`} className="hover:underline">{msg.phone}</a>
                        </span>
                      )}
                    </div>

                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</p>

                    {canWrite && (
                      <div className="mt-5 pt-4 border-t flex flex-wrap gap-2">
                        <a
                          href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: ${msg.subject || 'Your enquiry'}`)}`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          <Reply className="h-3.5 w-3.5" /> Reply by email
                        </a>
                        {msg.status !== 'REPLIED' && (
                          <Button variant="outline" size="sm" disabled={busy === msg.id} onClick={() => setStatus(msg, 'REPLIED')}>
                            Mark as replied
                          </Button>
                        )}
                        {msg.status !== 'ARCHIVED' && (
                          <Button variant="outline" size="sm" disabled={busy === msg.id} onClick={() => setStatus(msg, 'ARCHIVED')}>
                            Archive
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === msg.id}
                          onClick={() => remove(msg)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
