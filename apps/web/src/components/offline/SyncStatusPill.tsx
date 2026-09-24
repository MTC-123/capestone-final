'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { useOfflineQueue } from '@/lib/offline/useOfflineQueue';
import { useOfflineMessages } from '@/lib/offline/messages';
import { OfflineQueueSheet } from '@/components/offline/OfflineQueueSheet';
import type { SubmissionRecord } from '@/lib/offline/types';

export interface SyncStatusPillProps {
  className?: string;
  /** Wire this to your report-editing UI; forwarded to the queue sheet's Edit action. */
  onEdit?: (item: SubmissionRecord) => void;
}

/** Compact online/offline dot plus a pending count; click opens the offline queue. */
export function SyncStatusPill({ className, onEdit }: SyncStatusPillProps) {
  const { online, counts, syncing } = useOfflineQueue();
  const { t } = useOfflineMessages();
  const [open, setOpen] = React.useState(false);

  const pending = counts.saved + counts.pending + counts.failed + counts.needs_attention;
  const statusLabel = online ? t('online') : t('offline');
  const countLabel = pending > 0 ? t('pendingCount', { count: pending }) : t('noPending');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex select-none items-center gap-1.5 rounded-full border border-border/60 bg-surface-2 px-2.5 py-1',
          'text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-2 w-2 rounded-full',
            online ? 'bg-success' : 'bg-danger',
            syncing && 'animate-pulse'
          )}
        />
        <span>{statusLabel}</span>
        {pending > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
            {pending}
          </span>
        )}
      </button>

      {/* Status isn't conveyed by the dot's colour alone — this live region announces text on change. */}
      <span className="sr-only" role="status" aria-live="polite">
        {`${statusLabel}. ${countLabel}`}
      </span>

      <OfflineQueueSheet open={open} onOpenChange={setOpen} onEdit={onEdit} />
    </>
  );
}
