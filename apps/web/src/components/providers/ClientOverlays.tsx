'use client';

import dynamic from 'next/dynamic';

// Browser-only UI that has nothing to render on the server.
const OfflineBanner = dynamic(() => import('@/components/ui/OfflineBanner').then((m) => m.OfflineBanner), { ssr: false });
const ToastContainer = dynamic(() => import('@/components/ui/Toast').then((m) => m.ToastContainer), { ssr: false });

export function ClientOverlays({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineBanner />
      {children}
      <ToastContainer />
    </>
  );
}
