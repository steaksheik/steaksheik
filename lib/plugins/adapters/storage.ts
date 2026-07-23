import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import {
  PlatformServiceType,
  IStorageAdapter,
  ConnectionTestResult,
  HealthCheckResult,
} from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
import { extractAwsError, awsTestMessage, verboseServiceErrors } from '@/lib/plugins/adapters/_http';

/**
 * Resolve S3 settings from adapter config/credentials first, then env vars.
 * The admin backend stores bucketName / region / accessKeyId / secretAccessKey
 * on the STORAGE service; those take priority over any platform env fallback.
 */
interface S3Settings {
  bucketName: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  folderPrefix?: string;
}

export class S3StorageAdapter extends BaseAdapter implements IStorageAdapter {
  readonly id = 's3';
  readonly name = 'Amazon S3';
  readonly serviceType: PlatformServiceType = 'STORAGE';

  protected checkConfigured(): boolean {
    const s = this.settings();
    return Boolean(s.bucketName && s.region && (s.accessKeyId || process.env.AWS_ACCESS_KEY_ID));
  }

  private settings(extra?: Record<string, unknown>): S3Settings {
    const c = { ...(this.config ?? {}), ...(extra ?? {}) } as Record<string, unknown>;
    return {
      bucketName: (c.bucketName as string) ?? process.env.AWS_BUCKET_NAME ?? '',
      region: (c.region as string) ?? process.env.AWS_REGION ?? 'us-east-1',
      accessKeyId: (c.accessKeyId as string) ?? process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: (c.secretAccessKey as string) ?? process.env.AWS_SECRET_ACCESS_KEY,
      folderPrefix: (c.folderPrefix as string) ?? process.env.AWS_FOLDER_PREFIX ?? '',
    };
  }

  private async makeClient(extra?: Record<string, unknown>) {
    const s = this.settings(extra);
    const { S3Client } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: s.region,
      ...(s.accessKeyId && s.secretAccessKey
        ? { credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey } }
        : {}),
    });
    return { client, settings: s };
  }

  getPublicUrl(key: string): string {
    const s = this.settings();
    const encoded = String(key)
      .split('/')
      .map(encodeURIComponent)
      .join('/');
    return `https://${s.bucketName}.s3.${s.region}.amazonaws.com/${encoded}`;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      const { client, settings } = await this.makeClient();
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      return await getSignedUrl(
        client as never,
        new GetObjectCommand({ Bucket: settings.bucketName, Key: key }) as never,
        { expiresIn },
      );
    } catch {
      return this.getPublicUrl(key);
    }
  }

  /**
   * Upload a file buffer to S3 and return its public URL.
   * Used by the media upload endpoint.
   */
  async upload(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string,
    extra?: Record<string, unknown>,
  ): Promise<{ success: boolean; key: string; url?: string; error?: string }> {
    try {
      const { client, settings } = await this.makeClient(extra);
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const fullKey = settings.folderPrefix
        ? `${settings.folderPrefix.replace(/\/$/, '')}/${key}`
        : key;
      await client.send(
        new PutObjectCommand({
          Bucket: settings.bucketName,
          Key: fullKey,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { success: true, key: fullKey, url: this.getPublicUrl(fullKey) };
    } catch (err) {
      return { success: false, key, error: (err as Error).message };
    }
  }

  /**
   * REAL connectivity test: verifies the bucket exists, the region/keys are
   * valid, and that we can write + delete (upload permission). Returns a
   * precise, human-readable message for any failure.
   */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const s = this.settings(credentials);
    if (!s.bucketName) return { success: false, message: 'No bucket name provided.' };
    if (!s.region) return { success: false, message: 'No AWS region provided.' };
    if (!s.accessKeyId || !s.secretAccessKey) {
      return { success: false, message: 'AWS access key ID and secret access key are required.' };
    }

    try {
      const { client } = await this.makeClient(credentials);
      const {
        GetBucketLocationCommand,
        PutObjectCommand,
        DeleteObjectCommand,
      } = await import('@aws-sdk/client-s3');

      // 1. Validate credentials AND resolve the bucket's real region.
      //    GetBucketLocation returns a parseable error body (InvalidAccessKeyId,
      //    SignatureDoesNotMatch, AccessDenied, NoSuchBucket…), unlike HeadBucket
      //    which replies with a bare 403 and no error code — the reason a wrong
      //    key previously looked like a generic "Access denied".
      const loc = await client.send(new GetBucketLocationCommand({ Bucket: s.bucketName }));
      const actualRegion = (loc.LocationConstraint as string) || 'us-east-1';
      if (actualRegion && actualRegion !== s.region) {
        return {
          success: false,
          message: `Bucket "${s.bucketName}" is in region "${actualRegion}", but the configured region is "${s.region}". Change the region to "${actualRegion}".`,
          details: verboseServiceErrors() ? { actualRegion, configuredRegion: s.region } : undefined,
        };
      }

      // 2. Write permission — put and delete a tiny probe object.
      const probeKey = `${(s.folderPrefix || '').replace(/\/$/, '')}/_healthcheck/probe-${Date.now()}.txt`
        .replace(/^\//, '');
      await client.send(
        new PutObjectCommand({
          Bucket: s.bucketName,
          Key: probeKey,
          Body: 'steak-sheikh storage connectivity probe',
          ContentType: 'text/plain',
        }),
      );
      await client
        .send(new DeleteObjectCommand({ Bucket: s.bucketName, Key: probeKey }))
        .catch(() => undefined);

      return {
        success: true,
        message: `Connected to bucket "${s.bucketName}" in ${s.region}. Upload permission verified.`,
      };
    } catch (err) {
      const info = extractAwsError(err);
      // Always log the full, original AWS SDK error server-side.
      logger.error('S3 connection test failed', {
        bucket: s.bucketName,
        region: s.region,
        awsErrorName: info.name,
        awsErrorMessage: info.message,
        awsErrorCode: info.code,
        httpStatusCode: info.httpStatusCode,
        requestId: info.requestId,
        extendedRequestId: info.extendedRequestId,
      });
      return {
        success: false,
        message: awsTestMessage(this.describeError(err, s), info),
        details: verboseServiceErrors() ? (info as unknown as Record<string, unknown>) : undefined,
      };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    const s = this.settings();
    if (!this.checkConfigured()) {
      return {
        status: 'degraded',
        latencyMs: 0,
        message: 'Amazon S3 not fully configured.',
        checkedAt: new Date().toISOString(),
      };
    }
    try {
      const { client } = await this.makeClient();
      const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
      await client.send(new HeadBucketCommand({ Bucket: s.bucketName }));
      return {
        status: 'healthy',
        latencyMs: Date.now() - started,
        message: `Bucket "${s.bucketName}" reachable.`,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      const info = extractAwsError(err);
      logger.error('S3 health check failed', {
        bucket: s.bucketName,
        region: s.region,
        awsErrorName: info.name,
        awsErrorMessage: info.message,
        awsErrorCode: info.code,
        httpStatusCode: info.httpStatusCode,
        requestId: info.requestId,
      });
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - started,
        message: awsTestMessage(this.describeError(err, s), info),
        checkedAt: new Date().toISOString(),
      };
    }
  }

  private describeError(err: unknown, s: S3Settings): string {
    const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number }; message?: string };
    const code = e?.name || e?.Code || '';
    const http = e?.$metadata?.httpStatusCode;
    if (code === 'NoSuchBucket' || http === 404) {
      return `Bucket "${s.bucketName}" was not found. Check the bucket name.`;
    }
    if (code === 'PermanentRedirect' || code === 'BadRequest' || http === 301) {
      return `Bucket "${s.bucketName}" exists but not in region "${s.region}". Set the correct AWS region.`;
    }
    if (code === 'InvalidAccessKeyId' || code === 'InvalidClientTokenId' || code === 'UnrecognizedClientException') {
      return 'The AWS Access Key ID does not exist in AWS. The key was mistyped, deleted/deactivated in IAM, or belongs to a different AWS account than the bucket. Create a fresh access key for an IAM user in the account that owns this bucket.';
    }
    if (code === 'SignatureDoesNotMatch') return 'The AWS Secret Access Key is incorrect (it does not match the Access Key ID).';
    if (code === 'Forbidden' || code === 'AccessDenied' || http === 403) {
      return `Access denied for bucket "${s.bucketName}". The access key lacks permission (need s3:PutObject / s3:DeleteObject / s3:ListBucket).`;
    }
    if (code === 'UnknownEndpoint' || code === 'NetworkingError') {
      return `Could not reach AWS for region "${s.region}". Check the region value.`;
    }
    return `S3 error: ${e?.message || code || 'unknown error'}`;
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
