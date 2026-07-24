import Script from 'next/script';
import { getDefaultTenant, getBrand, getCategories, getPublicAnalyticsConfig } from '@/lib/storefront';
import { StorefrontShell } from './storefront-shell';
import { StorefrontProviders } from './storefront-providers';

export const dynamic = 'force-dynamic';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getDefaultTenant();
  const brand = await getBrand(tenant.id);
  const categories = await getCategories(tenant.id);
  const analytics = await getPublicAnalyticsConfig(tenant.id);

  return (
    <StorefrontProviders>
    {analytics.gtmContainerId && (
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${analytics.gtmContainerId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    )}
    {analytics.ga4MeasurementId && (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${analytics.ga4MeasurementId}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${analytics.ga4MeasurementId}');`}
        </Script>
      </>
    )}
    {analytics.gtmContainerId && (
      <Script id="gtm-init" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
            var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
            j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${analytics.gtmContainerId}');`}
      </Script>
    )}
    <StorefrontShell
      brand={brand ? {
        name: brand.name,
        tagline: brand.tagline,
        logoUrl: brand.logoUrl,
        theme: brand.theme ? {
          primaryColor: brand.theme.primaryColor,
          accentColor: brand.theme.accentColor,
          backgroundColor: brand.theme.backgroundColor,
          textColor: brand.theme.textColor,
        } : null,
      } : null}
      categories={categories.map(c => ({ name: c.name, slug: c.slug }))}
    >
      {children}
    </StorefrontShell>
    </StorefrontProviders>
  );
}
