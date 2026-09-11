import { Inter, Bebas_Neue, Cormorant_Garamond, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler'
import { PwaRegister } from '@/components/pwa-register'
import type { Metadata, Viewport } from 'next'
import { getDefaultTenant, getBrand } from '@/lib/storefront'

export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-heading' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-accent' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

const siteUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

// Fallback identity, used only if no brand has been saved yet.
const DEFAULT_NAME = "Sonny's Sweet & Savory"
const DEFAULT_DESCRIPTION = 'Premium halal steaks, signature burgers and sides — crafted with passion and delivered to your door.'

/**
 * Dynamic so the browser tab title, PWA name, and OpenGraph card always
 * reflect whatever's actually saved in Admin -> Branding, instead of a
 * hardcoded brand name baked in at deploy time. Page-level generateMetadata
 * (menu, product, wagyu-journey) sets only its own short title segment and
 * relies on the `%s | <name>` template below to append the brand name.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getDefaultTenant().catch(() => null)
  const brand = tenant ? await getBrand(tenant.id) : null
  const name = brand?.name || DEFAULT_NAME
  const description = brand?.description || DEFAULT_DESCRIPTION
  const faviconUrl = brand?.faviconUrl || undefined

  return {
    metadataBase: new URL(siteUrl),
    title: { default: name, template: `%s | ${name}` },
    description,
    alternates: { canonical: siteUrl },
    icons: {
      icon: faviconUrl
        ? [{ url: faviconUrl }]
        : [
            { url: '/favicon.svg', type: 'image/svg+xml' },
            { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          ],
      shortcut: faviconUrl || '/favicon.svg',
      apple: '/icons/apple-touch-icon.png',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: name,
    },
    openGraph: {
      title: name,
      description,
      images: ['/og-image.png'],
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
        {/*
          Chrome/Edge can decide the page is installable and fire
          beforeinstallprompt before React has hydrated. Capture it here,
          as early as physically possible, and stash it on window so the
          React install button (mounted later) never misses it.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault();
                window.__pwaInstallPrompt = e;
                window.dispatchEvent(new Event('pwaInstallPromptReady'));
              });
              window.addEventListener('appinstalled', function () {
                window.__pwaInstalled = true;
                window.__pwaInstallPrompt = null;
                window.dispatchEvent(new Event('pwaInstalled'));
              });
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${bebasNeue.variable} ${cormorant.variable} ${jetbrainsMono.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <PwaRegister />
          {/* IMPORTANT: Do not remove — handles chunk loading race conditions in the dev server */}
          <ChunkLoadErrorHandler />
        </ThemeProvider>
      </body>
    </html>
  )
}
