import { BaseAdapter, FallbackAdapter } from '@/lib/plugins/base';
import {
  PlatformServiceType,
  IMapsAdapter,
  GeocodingResult,
  ConnectionTestResult,
  HealthCheckResult,
} from '@/lib/plugins/types';
import { logger } from '@/lib/logger';
import { fetchWithTimeout, describeNetworkError } from '@/lib/plugins/adapters/_http';

export class GoogleMapsAdapter extends BaseAdapter implements IMapsAdapter {
  readonly id = 'google-maps';
  readonly name = 'Google Maps';
  readonly serviceType: PlatformServiceType = 'MAPS';

  protected checkConfigured(): boolean {
    return Boolean(this.config?.apiKey);
  }

  async geocode(address: string): Promise<GeocodingResult> {
    if (!this.isConfigured()) throw new Error('Google Maps not configured');
    const key = String(this.config?.apiKey ?? '');
    try {
      const res = await fetchWithTimeout(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        results?: { geometry?: { location?: { lat: number; lng: number } }; formatted_address?: string }[];
      };
      const first = data.results?.[0];
      if (data.status === 'OK' && first?.geometry?.location) {
        return {
          success: true,
          lat: first.geometry.location.lat,
          lng: first.geometry.location.lng,
          formattedAddress: first.formatted_address ?? address,
        };
      }
      return { success: false, lat: 0, lng: 0, formattedAddress: address };
    } catch (err) {
      logger.error('Google Maps geocode failed', { error: String(err) });
      return { success: false, lat: 0, lng: 0, formattedAddress: address };
    }
  }

  /** REAL test: perform a tiny geocode and inspect the API status. */
  async testConnection(credentials: Record<string, unknown>): Promise<ConnectionTestResult> {
    const key = String(credentials?.apiKey ?? this.config?.apiKey ?? '');
    if (!key) return { success: false, message: 'Google Maps API key is required.' };
    try {
      const res = await fetchWithTimeout(
        `https://maps.googleapis.com/maps/api/geocode/json?address=London&key=${encodeURIComponent(key)}`,
      );
      const data = (await res.json().catch(() => ({}))) as { status?: string; error_message?: string };
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        return { success: true, message: 'Google Maps API key valid — geocoding responded successfully.' };
      }
      if (data.status === 'REQUEST_DENIED') {
        return { success: false, message: data.error_message || 'Request denied — key invalid or Geocoding API not enabled for this key.' };
      }
      if (data.status === 'OVER_QUERY_LIMIT') {
        return { success: false, message: 'Key is over its query limit / billing not enabled.' };
      }
      return { success: false, message: `Google Maps returned status "${data.status ?? 'unknown'}".` };
    } catch (err) {
      return { success: false, message: describeNetworkError(err) };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    if (!this.checkConfigured()) {
      return { status: 'degraded', latencyMs: 0, message: 'Google Maps not configured.', checkedAt: new Date().toISOString() };
    }
    const t = await this.testConnection({});
    return {
      status: t.success ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - started,
      message: t.message,
      checkedAt: new Date().toISOString(),
    };
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
