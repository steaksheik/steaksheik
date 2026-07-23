import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import { PlatformServiceType, IStorageAdapter } from '@/lib/plugins/types';

export class S3StorageAdapter extends BaseAdapter implements IStorageAdapter {
  readonly id = 's3';
  readonly name = 'Amazon S3';
  readonly serviceType: PlatformServiceType = 'STORAGE';

  protected checkConfigured(): boolean {
    // Uses platform-managed S3 env vars when present.
    return Boolean(process.env.AWS_BUCKET_NAME) || Boolean(this.config?.bucketName);
  }

  getPublicUrl(key: string): string {
    const bucket = (this.config?.bucketName as string) ?? process.env.AWS_BUCKET_NAME ?? '';
    const region = (this.config?.region as string) ?? process.env.AWS_REGION ?? 'us-east-1';
    const encoded = String(key)
      .split('/')
      .map(encodeURIComponent)
      .join('/');
    return `https://${bucket}.s3.${region}.amazonaws.com/${encoded}`;
  }

  async getSignedUrl(key: string): Promise<string> {
    // Real presigned URL generation lives in lib/s3.ts. Adapter returns public form.
    return this.getPublicUrl(key);
  }
}

export class LocalStorageAdapter extends FallbackAdapter implements IStorageAdapter {
  readonly id = 'local';
  readonly name = 'Local Storage (fallback)';
  readonly serviceType: PlatformServiceType = 'STORAGE';

  getPublicUrl(key: string): string {
    return `/uploads/${key}`;
  }
  async getSignedUrl(key: string): Promise<string> {
    return this.getPublicUrl(key);
  }
}
