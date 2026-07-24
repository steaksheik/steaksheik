import Script from 'next/script';
import { cookies } from 'next/headers';
import { getDefaultTenant, getBrand, getCategories, getPublicAnalyticsConfig } from '@/lib/storefront';
import { StorefrontShell } from './storefront-shell';
import { StorefrontProviders } from './storefront-providers';
import { CookieConsentBanner } from './cookie-consent-banner';

export const dynamic = 'force-dynamic';

const CONSENT_COOKIE = 'ck_consent';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getDefaultTenant();
  const brand = await getBrand(tenant.id);
  const categories = await getCategories(tenant.id);
  const analyticsConfig = await getPublicAnalyticsConfig(tenant.id);

  const cookieStore = await cookies();
  const consentValue = cookieStore.get(CONSENT_COOKIE)?.value;
  const hasDecision = consentValue === 'accepted' || consentValue === 'rejected';
  const analyticsConsented = consentValue === 'accepted';
  // Only actually load GA4/GTM once the visitor has consented — showing the
  // banner while the trackers load underneath regardless is not compliant.
  const analytics = analyticsConsented ? analyticsConfig : { ga4MeasurementId: null, gtmContainerId: null };

  return (
    <StorefrontProviders>
    <CookieConsentBanner hasDecision={hasDecision} />
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
