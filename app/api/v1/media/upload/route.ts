import { NextRequest } from 'next/server';
import { withRoute } from '@/lib/api/route';
import { ok } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { getConfiguredStorage } from '@/lib/plugins/storage';
import { auditLog } from '@/lib/audit/service';
import { Errors } from '@/lib/api/errors';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allowed MIME types and per-category size caps.
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};
const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB

// Only these destination folders are permitted (prevents arbitrary key paths).
const ALLOWED_FOLDERS = new Set(['hero', 'branding', 'products', 'categories', 'media', 'marketing']);

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'file';
}

/**
 * POST /api/v1/media/upload — multipart/form-data
 *   field `file`   (required): the image or video blob
 *   field `folder` (optional): one of hero|branding|products|categories|media
 *
 * Streams the file to the configured S3 bucket and returns { url, key }.
 */
export const POST = withRoute(
  async (req: NextRequest) => {
    const ctx = await requirePermission(req, 'branding:assets:write');

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw Errors.validation('Expected multipart/form-data with a "file" field.');
    }

    const file = form.get('file');
    if (!file || typeof file === 'string') {
      throw Errors.validation('No file provided.');
    }

    const blob = file as File;
    const mime = blob.type || 'application/octet-stream';
    const isImage = mime in IMAGE_TYPES;
    const isVideo = mime in VIDEO_TYPES;
    if (!isImage && !isVideo) {
      throw Errors.validation(
        `Unsupported file type "${mime}". Allowed: JPG, PNG, WEBP, GIF, SVG, AVIF, MP4, WEBM, MOV.`,
      );
    }

    const size = blob.size ?? 0;
    const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (size > cap) {
      throw Errors.validation(
        `File is too large (${(size / 1024 / 1024).toFixed(1)} MB). Max ${(cap / 1024 / 1024).toFixed(0)} MB for ${isVideo ? 'videos' : 'images'}.`,
      );
    }

    const folderRaw = (form.get('folder') as string | null)?.trim() || 'media';
    const folder = ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : 'media';
    const ext = isImage ? IMAGE_TYPES[mime] : VIDEO_TYPES[mime];
    const key = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${slug(blob.name || 'file')}.${ext}`;

    const buffer = Buffer.from(await blob.arrayBuffer());

    const storage = await getConfiguredStorage();
    const result = await storage.upload(key, buffer, mime);

    if (!result.success) {
      // Storage not connected / S3 rejected the write — surface a clear reason.
      throw Errors.unavailable(result.error || 'Upload failed. Storage is not available.');
    }

    const url = result.url ?? storage.getPublicUrl(result.key);

    await auditLog({
      tenantId: ctx.tenantId,
      userId: ctx.session.userId,
      action: 'media.uploaded',
      resource: 'Media',
      resourceId: result.key,
      after: { key: result.key, url, mimeType: mime, fileSize: size, folder },
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return ok(
      { url, key: result.key, mimeType: mime, fileSize: size, kind: isVideo ? 'video' : 'image' },
      { status: 201 },
    );
  },
  { rateLimit: 'upload' },
);
