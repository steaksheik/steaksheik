import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import { PlatformServiceType, ICdnAdapter } from '@/lib/plugins/types';
import { logger } from '@/lib/logger';

export class CloudFrontCdnAdapter extends BaseAdapter implements ICdnAdapter {
  readonly id = 'cloudfront';
  readonly name = 'Amazon CloudFront';
  readonly serviceType: PlatformServiceType = 'CDN';

  protected checkConfigured(): boolean {
    return Boolean(this.config?.distributionId && this.config?.domain);
  }

  async invalidate(paths: string[]): Promise<void> {
    logger.info('CloudFront invalidate (stub)', { count: paths?.length ?? 0 });
  }
  getDistributionUrl(key: string): string {
    const domain = (this.config?.domain as string) ?? '';
    return domain ? `https://${domain}/${key}` : `/${key}`;
  }
}

export class CloudflareCdnAdapter extends BaseAdapter implements ICdnAdapter {
  readonly id = 'cloudflare';
  readonly name = 'Cloudflare';
  readonly serviceType: PlatformServiceType = 'DNS_CDN';

  protected checkConfigured(): boolean {
    return Boolean(this.config?.apiToken && this.config?.zoneId);
  }

  async invalidate(paths: string[]): Promise<void> {
    logger.info('Cloudflare purge (stub)', { count: paths?.length ?? 0 });
  }
  getDistributionUrl(key: string): string {
    const domain = (this.config?.domain as string) ?? '';
    return domain ? `https://${domain}/${key}` : `/${key}`;
  }
}

export class NoopCdnAdapter extends FallbackAdapter implements ICdnAdapter {
  readonly id = 'noop';
  readonly name = 'No-op CDN (fallback)';
  readonly serviceType: PlatformServiceType = 'CDN';

  async invalidate(): Promise<void> {
    /* returns direct URLs; nothing to invalidate */
  }
  getDistributionUrl(key: string): string {
    return `/${key}`;
  }
}
