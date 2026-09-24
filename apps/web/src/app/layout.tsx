import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import LocaleSync from '@/components/layout/LocaleSync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorProvider } from '@/contexts/ErrorContext';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { getRequestPreferences } from '@/lib/i18n/server';
import { ClientOverlays } from '@/components/providers/ClientOverlays';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BASE_URL || 'http://localhost:3000'),
  title: {
    default: 'RICER Ifrane — Forest fire response',
    template: '%s · RICER Ifrane',
  },
  description:
    'Fire reporting, dispatch and multi-agency coordination for Ifrane Province, Morocco. Capstone project, Al Akhawayn University.',
  applicationName: 'RICER Ifrane',
  icons: {
    icon: [
      { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: '16x16 32x32' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f14' },
  ],
};

const fontSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const fontArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir, theme, persona } = await getRequestPreferences();

  return (
    <html
      lang={locale}
      dir={dir}
      data-persona={persona}
      className={`${theme === 'dark' ? 'dark' : ''} ${fontSans.variable} ${fontArabic.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <PreferencesProvider locale={locale} theme={theme} persona={persona}>
          <ErrorBoundary>
            <ErrorProvider>
              <LocaleSync />
              <ClientOverlays>{children}</ClientOverlays>
            </ErrorProvider>
          </ErrorBoundary>
        </PreferencesProvider>
      </body>
    </html>
  );
}
