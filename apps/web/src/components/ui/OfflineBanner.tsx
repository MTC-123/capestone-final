'use client';

import { useEffect, useState } from 'react';
import { useMapStore } from '@/store/useMapStore';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [, forceRender] = useState(0);
  const lastSuccessfulSync = useMapStore((s) => s.lastSuccessfulSync);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Refresh the "X min ago" label every 30 seconds
    const timer = setInterval(() => forceRender((n) => n + 1), 30_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 inset-x-0 z-[9998] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow"
    >
      <span>⚠ Offline — map data may be outdated.</span>
      {lastSuccessfulSync && (
        <span className="opacity-80">Last sync: {formatTimeAgo(lastSuccessfulSync)}</span>
      )}
    </div>
  );
}
