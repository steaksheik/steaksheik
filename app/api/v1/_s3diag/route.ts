import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decryptCredentials } from '@/lib/security/crypto';

export const dynamic = 'force-dynamic';

const DIAG_TOKEN = 'bdd80bb47fda1e40087b50fc62d28c5a';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('token') !== DIAG_TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const out: any = { steps: [] };
  try {
    const svc = await prisma.platformService.findFirst({ where: { serviceType: 'STORAGE' as never } });
    if (!svc) return NextResponse.json({ error: 'no STORAGE service row' });
    const creds = decryptCredentials((svc.credentials ?? {}) as any);
    const config = (svc.config ?? {}) as any;
    const merged: any = { ...config, ...creds };
    const ak = String(merged.accessKeyId ?? '');
    const sk = String(merged.secretAccessKey ?? '');
    out.stored = {
      bucketName: merged.bucketName,
      region: merged.region,
      accessKeyId: ak ? `${ak.slice(0,4)}...${ak.slice(-4)} (len ${ak.length})` : '(empty)',
      secretKeySet: sk ? `len ${sk.length}` : '(empty)',
      folderPrefix: merged.folderPrefix ?? null,
      akHasWhitespace: ak !== ak.trim(),
      skHasWhitespace: sk !== sk.trim(),
      configKeys: Object.keys(config),
      credKeys: Object.keys(creds),
    };
    const region = String(merged.region || 'us-east-1');
    const bucket = String(merged.bucketName || '');
    const cred = { accessKeyId: ak, secretAccessKey: sk };

    const { S3Client, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand, GetBucketLocationCommand, ListBucketsCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region, credentials: cred });

    try {
      const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
      const sts = new STSClient({ region, credentials: cred });
      const id = await sts.send(new GetCallerIdentityCommand({}));
      out.steps.push({ step: 'sts', ok: true, account: id.Account, arn: id.Arn });
    } catch (e: any) {
      out.steps.push({ step: 'sts', ok: false, name: e?.name, message: e?.message, http: e?.$metadata?.httpStatusCode });
    }
    try {
      const lb = await client.send(new ListBucketsCommand({}));
      out.steps.push({ step: 'listBuckets', ok: true, buckets: (lb.Buckets ?? []).map((b: any) => b.Name) });
    } catch (e: any) {
      out.steps.push({ step: 'listBuckets', ok: false, name: e?.name, message: e?.message, http: e?.$metadata?.httpStatusCode });
    }
    try {
      const loc = await client.send(new GetBucketLocationCommand({ Bucket: bucket }));
      out.steps.push({ step: 'getBucketLocation', ok: true, locationConstraint: loc.LocationConstraint ?? '(null=us-east-1)' });
    } catch (e: any) {
      out.steps.push({ step: 'getBucketLocation', ok: false, name: e?.name, message: e?.message, http: e?.$metadata?.httpStatusCode, requestId: e?.$metadata?.requestId, bucketRegionHeader: e?.$response?.headers?.['x-amz-bucket-region'] });
    }
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      out.steps.push({ step: 'headBucket', ok: true });
    } catch (e: any) {
      out.steps.push({ step: 'headBucket', ok: false, name: e?.name, message: e?.message, http: e?.$metadata?.httpStatusCode, requestId: e?.$metadata?.requestId, bucketRegionHeader: e?.$response?.headers?.['x-amz-bucket-region'] });
    }
    try {
      const key = `_healthcheck/probe-${Date.now()}.txt`;
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'probe', ContentType: 'text/plain' }));
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      out.steps.push({ step: 'putDelete', ok: true, key });
    } catch (e: any) {
      out.steps.push({ step: 'putDelete', ok: false, name: e?.name, message: e?.message, http: e?.$metadata?.httpStatusCode, requestId: e?.$metadata?.requestId });
    }
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ fatal: e?.name, message: e?.message, stack: e?.stack }, { status: 500 });
  }
}
