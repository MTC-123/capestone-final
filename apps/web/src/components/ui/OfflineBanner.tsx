'use client';

import { useEffect, useState } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon } from '@/components/ui/Icon';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [, forceRender] = useState(0);
  const lastSuccessfulSync = useMapStore((s) => s.lastSuccessfulSync);
  const { t } = useTranslation();

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
      className="fixed inset-x-0 top-0 z-[9998] flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-white shadow-elev-2"
    >
      <Icon name="wifiOff" size={16} aria-hidden />
      <span>{t('offlineBannerMessage')}</span>
      {lastSuccessfulSync && (
        <span className="opacity-80">
          {t('lastSyncLabel')}: {formatTimeAgo(lastSuccessfulSync)}
        </span>
      )}
    </div>
  );
}
