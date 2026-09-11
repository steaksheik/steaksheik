
import type { MetadataRoute } from 'next';
import { getDefaultTenant, getBrand } from '@/lib/storefront';

const DEFAULT_NAME = "Sonny's Sweet & Savory";
const DEFAULT_DESCRIPTION = 'Premium halal steaks, signature burgers and sides — order ahead for delivery or collection.';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tenant = await getDefaultTenant().catch(() => null);
  const brand = tenant ? await getBrand(tenant.id) : null;
  const name = brand?.name || DEFAULT_NAME;

  return {
    name,
    short_name: name,
    description: brand?.description || DEFAULT_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    categories: ['food', 'shopping'],
    icons: [
      { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
