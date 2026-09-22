import type { Metadata, Viewport } from 'next';
import { Urbanist, JetBrains_Mono } from 'next/font/google';
import dynamic from 'next/dynamic';
import './globals.css';
import LocaleSync from '@/components/layout/LocaleSync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorProvider } from '@/contexts/ErrorContext';

const OfflineBanner = dynamic(
  () => import('@/components/ui/OfflineBanner').then((m) => m.OfflineBanner),
  { ssr: false }
);
const ToastContainer = dynamic(
  () => import('@/components/ui/Toast').then((m) => m.ToastContainer),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'RICER Ifrane - نظام الإبلاغ عن الحرائق',
  description: 'نظام إدارة الحرائق والإبلاغ عنها في إفران، المغرب',
  icons: {
    icon: [
      { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: '16x16 32x32' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const fontSans = Urbanist({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${fontSans.variable} ${fontMono.variable}`}>
        <ErrorBoundary>
          <ErrorProvider>
            <LocaleSync />
            <OfflineBanner />
            {children}
            <ToastContainer />
          </ErrorProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
