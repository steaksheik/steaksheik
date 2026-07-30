
import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Transactional/private/system routes carry no indexable content and
      // create duplicate or low-quality signals if crawled.
      disallow: ['/admin', '/api', '/checkout', '/account', '/order-confirmation'],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
