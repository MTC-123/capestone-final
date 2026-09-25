'use client';

import * as React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useOfflineMessages } from '@/lib/offline/messages';
import { useOfflineQueue } from '@/lib/offline/useOfflineQueue';

/**
 * Offline fallback page. The service worker serves this when a navigation
 * fails and there's no cached copy of the requested page (see public/sw.js).
 */
export default function OfflinePage() {
  const { t } = useOfflineMessages();
  const { online, counts } = useOfflineQueue();
  const pending = counts.saved + counts.pending + counts.failed + counts.needs_attention;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Icon name="cloud" size={32} aria-hidden={true} />
      </div>

      <div className="space-y-2">
        <h1 className="text-fluid-2xl font-bold text-foreground">{t('offlinePageTitle')}</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{t('offlinePageBody')}</p>
      </div>

      <p role="status" aria-live="polite" className="text-xs font-semibold text-muted-foreground">
        {online ? t('online') : t('offline')}
        {pending > 0 ? ` — ${t('pendingCount', { count: pending })}` : ''}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="primary" onClick={() => window.location.reload()}>
          <Icon name="refresh" size={16} aria-hidden={true} />
          {t('offlinePageRetry')}
        </Button>
        <Link
          href="/report"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border/50 bg-surface-2 px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t('offlinePageGoQueue')}
        </Link>
      </div>
    </main>
  );
}
