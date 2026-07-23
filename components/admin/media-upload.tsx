'use client';

import { useCallback, useRef, useState } from 'react';
import { useAdmin } from '@/lib/admin-auth-context';
import { toast } from 'sonner';
import { Upload, Loader2, X, Film, Image as ImageIcon } from 'lucide-react';

export interface UploadedMedia {
  url: string;
  key: string;
  mimeType: string;
  fileSize: number;
  kind: 'image' | 'video';
}

type AcceptKind = 'image' | 'video' | 'both';

const ACCEPT_ATTR: Record<AcceptKind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif',
  video: 'video/mp4,video/webm,video/quicktime',
  both: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,video/mp4,video/webm,video/quicktime',
};

export interface MediaUploadProps {
  /** Destination folder: hero | branding | products | categories | media */
  folder?: string;
  /** What file kinds to accept. Default: image */
  accept?: AcceptKind;
  /** Current value (URL) to preview. */
  value?: string | null;
  /** Called with the full result after a successful upload. */
  onUploaded: (media: UploadedMedia) => void;
  /** Called when the user clears the current value. */
  onClear?: () => void;
  disabled?: boolean;
  /** Compact single-line dropzone height. Default false (taller). */
  compact?: boolean;
  className?: string;
}

/** Heuristic: does a URL look like a video by extension? */
function looksLikeVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

/**
 * Reusable drag-and-drop / click-to-pick media uploader.
 * Sends the file to /api/v1/media/upload (S3) and returns the public URL.
 * Reused for hero slides, brand logo/favicon and product images.
 */
export function MediaUpload({
  folder = 'media',
  accept = 'image',
  value,
  onUploaded,
  onClear,
  disabled = false,
  compact = false,
  className = '',
}: MediaUploadProps) {
  const { authHeaders } = useAdmin();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(
    (file: File) => {
      if (disabled || busy) return;
      setBusy(true);
      setProgress(0);

      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', folder);

      // authHeaders() includes Content-Type: application/json which would break
      // the multipart boundary — strip it and keep only the CSRF token.
      const headers = { ...authHeaders() } as Record<string, string>;
      delete headers['Content-Type'];
      delete headers['content-type'];

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/v1/media/upload');
      xhr.withCredentials = true;
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setBusy(false);
        setProgress(0);
        let json: { success?: boolean; data?: UploadedMedia; error?: { message?: string } } = {};
        try {
          json = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300 && json.data) {
          onUploaded(json.data);
          toast.success('Uploaded');
        } else {
          toast.error(json.error?.message || `Upload failed (${xhr.status})`);
        }
      };
      xhr.onerror = () => {
        setBusy(false);
        setProgress(0);
        toast.error('Network error during upload');
      };
      xhr.send(fd);
    },
    [authHeaders, folder, disabled, busy, onUploaded],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const isVideo = value ? looksLikeVideo(value) : false;

  return (
    <div className={className}>
      {value ? (
        <div className="group relative overflow-hidden rounded-lg border bg-muted/30">
          {isVideo ? (
            <video
              src={value}
              className="h-40 w-full object-contain bg-black"
              muted
              loop
              playsInline
              controls
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Uploaded media"
              className="h-40 w-full object-contain"
              onError={(ev) => {
                (ev.target as HTMLImageElement).style.opacity = '0.3';
              }}
            />
          )}
          {!disabled && (
            <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white hover:bg-black"
              >
                Replace
              </button>
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-md bg-black/70 p-1.5 text-white hover:bg-red-600"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">{progress}%</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors ${
            compact ? 'h-20 px-3' : 'h-40 px-4'
          } ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
          } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{progress}% uploading…</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {accept === 'video' ? (
                  <Film className="h-5 w-5" />
                ) : accept === 'both' ? (
                  <>
                    <ImageIcon className="h-5 w-5" />
                    <Film className="h-5 w-5" />
                  </>
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
                <Upload className="h-4 w-4" />
              </div>
              <span className="text-center text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Click to upload</span> or drag & drop
                <br />
                {accept === 'image'
                  ? 'PNG, JPG, WEBP, GIF, SVG (max 10 MB)'
                  : accept === 'video'
                  ? 'MP4, WEBM, MOV (max 60 MB)'
                  : 'Images (10 MB) or video (60 MB)'}
              </span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR[accept]}
        className="hidden"
        onChange={onPick}
        disabled={disabled || busy}
      />
    </div>
  );
}
