
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Images, Search } from 'lucide-react';
import { MediaUpload, type UploadedMedia } from '@/components/admin/media-upload';

interface MediaAssetRow {
  id: string;
  url: string;
  key: string;
  kind: string;
  folder: string;
  createdAt: string;
}

export interface MediaPickerProps {
  value: string;
  onChange: (url: string) => void;
  /** Destination folder for new uploads made from this picker. */
  folder?: string;
  disabled?: boolean;
}

/**
 * Image field backed by the shared media library: browse everything
 * previously uploaded anywhere in the admin, or upload a new file. Replaces
 * raw "paste an image URL" fields on product/category (and future) forms.
 */
export function MediaPicker({ value, onChange, folder = 'media', disabled }: MediaPickerProps) {
  const { authHeaders } = useAdmin();
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const loadAssets = useCallback(
    (q: string) => {
      setLoading(true);
      const params = new URLSearchParams({ kind: 'image', limit: '60' });
      if (q.trim()) params.set('search', q.trim());
      fetch(`/api/v1/media?${params}`, { credentials: 'include', headers: authHeaders() })
        .then((r) => r.json())
        .then((json) => setAssets(json.data?.assets ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [authHeaders],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => loadAssets(search), search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search]);

  const select = (url: string) => {
    onChange(url);
    setOpen(false);
  };

  return (
    <>
      {value ? (
        <div className="space-y-1.5">
          <div className="aspect-video max-w-[220px] rounded-md overflow-hidden border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
              Change image
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange('')}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
          <Images className="h-3.5 w-3.5 mr-1.5" /> Choose image
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose an image</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="library">
            <TabsList>
              <TabsTrigger value="library">Media library</TabsTrigger>
              <TabsTrigger value="upload">Upload new</TabsTrigger>
            </TabsList>

            <TabsContent value="library" className="pt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by filename..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : assets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">
                  No images uploaded yet — switch to &quot;Upload new&quot;.
                </p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[340px] overflow-y-auto pr-1">
                  {assets.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => select(a.url)}
                      className={`aspect-square rounded-md overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all ${
                        value === a.url ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload" className="pt-3">
              <MediaUpload folder={folder} accept="image" onUploaded={(media: UploadedMedia) => select(media.url)} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
