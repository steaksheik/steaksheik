import { pluginRegistry } from '@/lib/plugins/registry';
import type { IMapsAdapter } from '@/lib/plugins/types';

/**
 * Load the MAPS service's stored (encrypted) credentials, reconfigure the
 * Google Maps adapter with them and return the active adapter.
 *
 * If Maps isn't enabled/configured the registry hands back the no-op
 * fallback, whose geocode() returns lat/lng 0,0 with success:false — so
 * callers get a clear "not connected" signal instead of a crash.
 */
export async function getConfiguredMaps(): Promise<IMapsAdapter> {
  try {
    const { prisma } = await import('@/lib/db');
    const svc = await prisma.platformService.findFirst({
      where: { serviceType: 'MAPS' as never, isEnabled: true },
    });
    if (svc) {
      const { decryptCredentials } = await import('@/lib/security/crypto');
      const creds = decryptCredentials((svc.credentials ?? {}) as Record<string, unknown>);
      const config = (svc.config ?? {}) as Record<string, unknown>;
      await pluginRegistry.reconfigure('MAPS', { ...config, ...creds });
    }
  } catch {
    /* fall through to whatever adapter the registry returns */
  }
  return pluginRegistry.get<IMapsAdapter>('MAPS');
}
