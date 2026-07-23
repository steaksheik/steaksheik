import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import { PlatformServiceType, IMapsAdapter, GeocodingResult } from '@/lib/plugins/types';
import { logger } from '@/lib/logger';

export class GoogleMapsAdapter extends BaseAdapter implements IMapsAdapter {
  readonly id = 'google-maps';
  readonly name = 'Google Maps';
  readonly serviceType: PlatformServiceType = 'MAPS';

  protected checkConfigured(): boolean {
    return Boolean(this.config?.apiKey);
  }

  async geocode(address: string): Promise<GeocodingResult> {
    if (!this.isConfigured()) throw new Error('Google Maps not configured');
    logger.info('Google Maps geocode (stub)', { address });
    return { success: true, lat: 0, lng: 0, formattedAddress: address };
  }
}

export class NoopMapsAdapter extends FallbackAdapter implements IMapsAdapter {
  readonly id = 'noop';
  readonly name = 'No-op Maps (fallback)';
  readonly serviceType: PlatformServiceType = 'MAPS';

  async geocode(address: string): Promise<GeocodingResult> {
    logger.info('[MAPS:noop] Mock geocode', { address });
    return { success: true, lat: 0, lng: 0, formattedAddress: address };
  }
}
