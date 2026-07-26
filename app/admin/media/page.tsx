
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Loader2, ImageIcon, Trash2, Copy, Film, Upload } from 'lucide-react';
import { MediaUpload, type UploadedMedia } from '@/components/admin/media-upload';

interface MediaAssetRow {
  id: string;
  url: string;
  key: string;
  mimeType: string;
  fileSize: number;
  folder: string;
  kind: 'image' | 'video';
  createdAt: string;
  uploadedBy: string | null;
}

const FOLDERS = ['hero', 'branding', 'products', 'categories', 'marketing', 'media'];
const PAGE_SIZE = 60;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MediaLibraryPage() {
  const { authHeaders, hasPermission } = useAdmin();
  const canManage = hasPermission('branding:assets:write');
  const canDelete = hasPermission('branding:assets:delete');

  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState<string>('all');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<MediaAssetRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    (offset: number, append: boolean) => {
      if (!canManage) { setLoading(false); return; }
      append ? setLoadingMore(true) : setLoading(true);
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (search.trim()) params.set('search', search.trim());
      if (folder !== 'all') params.set('folder', folder);
      fetch(`/api/v1/media?${params}`, { credentials: 'include', headers: authHeaders() })
        .then((r) => r.json())
        .then((json) => {
          const rows: MediaAssetRow[] = json.data?.assets ?? [];
          setAssets((prev) => (append ? [...prev, ...rows] : rows));
          setTotal(json.data?.total ?? 0);
        })
        .catch(() => toast.error('Failed to load media library'))
        .finally(() => { setLoading(false); setLoadingMore(false); });
    },
    [authHeaders, canManage, search, folder],
  );

  useEffect(() => {
    const t = setTimeout(() => load(0, false), search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, folder]);

  const onUploaded = (_media: UploadedMedia) => {
    toast.success('Uploaded');
    setUploadOpen(false);
    load(0, false);
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL copied');
    } catch {
      toast.error('Could not copy — copy it manually');
    }
  };

  const remove = async (asset: MediaAssetRow) => {
    if (!confirm('Delete this file? Anywhere it\'s currently used (product/category images, etc.) will show a broken image.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/media/${asset.id}`, {
        method: 'DELETE', credentials: 'include', headers: authHeaders(),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success('Deleted');
      setPreview(null);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setTotal((t) => t - 1);
    } catch (e) {
      toast.error((e as Error).message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don&apos;t have permission to view the media library.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Media Library</h1>
          <p className="text-muted-foreground mt-1">
            Everything uploaded across the admin — products, categories, campaigns, branding — in one place.
          </p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" /> Upload
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by filename..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={folder} onValueChange={setFolder}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All folders</SelectItem>
            {FOLDERS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="shrink-0">{total} file{total === 1 ? '' : 's'}</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : assets.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center text-muted-foreground">
            {search || folder !== 'all' ? 'No files match this filter.' : 'Nothing uploaded yet — click Upload to add your first file.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setPreview(a)}
                className="group relative aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all text-left"
              >
                {a.kind === 'video' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <Film className="h-6 w-6" />
                    <span className="text-[10px] px-2 truncate w-full text-center">{a.key.split('/').pop()}</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                  {a.folder}
                </div>
              </button>
            ))}
          </div>
          {assets.length < total && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => load(assets.length, true)}>
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload to media library</DialogTitle></DialogHeader>
          <MediaUpload folder="media" accept="both" onUploaded={onUploaded} />
        </DialogContent>
      </Dialog>

      {/* Preview / detail dialog */}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-lg">
          {preview && (
            <>
              <DialogHeader><DialogTitle className="truncate pr-6">{preview.key.split('/').pop()}</DialogTitle></DialogHeader>
              <div className="rounded-md overflow-hidden border bg-muted max-h-[320px] flex items-center justify-center">
                {preview.kind === 'video' ? (
                  <video src={preview.url} controls className="max-h-[320px] w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.url} alt="" className="max-h-[320px] w-full object-contain" />
                )}
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5"><ImageIcon className="h-3 w-3" /> {preview.mimeType} • {fmtBytes(preview.fileSize)} • {preview.folder}</p>
                <p>Uploaded {fmtDate(preview.createdAt)}{preview.uploadedBy ? ` by ${preview.uploadedBy}` : ''}</p>
                <p className="truncate font-mono text-[10px]">{preview.url}</p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" size="sm" onClick={() => copyUrl(preview.url)}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy URL
                </Button>
                {canDelete && (
                  <Button variant="destructive" size="sm" disabled={deleting} onClick={() => remove(preview)}>
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                    Delete
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
