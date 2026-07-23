import { pluginRegistry } from '@/lib/plugins/registry';
import type { IStorageAdapter } from '@/lib/plugins/types';

/**
 * Load the STORAGE service's stored (encrypted) credentials, reconfigure the
 * S3 adapter with them and return the active adapter.
 *
 * If S3 is not enabled / not usable the registry hands back the local
 * fallback adapter, whose `upload()` returns a clear "storage not connected"
 * error — so callers get a graceful failure instead of a crash.
 */
export async function getConfiguredStorage(): Promise<IStorageAdapter> {
  try {
    const { prisma } = await import('@/lib/db');
    const svc = await prisma.platformService.findFirst({
      where: { serviceType: 'STORAGE' as never, isEnabled: true },
    });
    if (svc) {
      const { decryptCredentials } = await import('@/lib/security/crypto');
      const creds = decryptCredentials((svc.credentials ?? {}) as Record<string, unknown>);
      const config = (svc.config ?? {}) as Record<string, unknown>;
      await pluginRegistry.reconfigure('STORAGE', { ...config, ...creds });
    }
  } catch {
    /* fall through to whatever adapter the registry returns */
  }
  return pluginRegistry.get<IStorageAdapter>('STORAGE');
}
