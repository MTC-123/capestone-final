'use client';

import * as React from 'react';
import { RightDrawer } from '@/components/shell/RightDrawer';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useOfflineQueue } from '@/lib/offline/useOfflineQueue';
import { useOfflineMessages } from '@/lib/offline/messages';
import { SubmissionStateChip } from '@/components/offline/SubmissionStateChip';
import type { SubmissionRecord } from '@/lib/offline/types';

export interface OfflineQueueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Wire this to your report-editing UI; when omitted the Edit action is hidden. */
  onEdit?: (item: SubmissionRecord) => void;
  className?: string;
}

function errorMessage(
  item: SubmissionRecord,
  t: ReturnType<typeof useOfflineMessages>['t']
): string | undefined {
  if (!item.lastError) return undefined;
  if (item.state === 'needs_attention' && item.lastError.status === 401) return t('errorSignInAgain');
  if (item.state === 'needs_attention') return item.lastError.message || t('errorValidation');
  if (item.state === 'failed' && !item.lastError.status) return t('errorNetwork');
  return item.lastError.message || t('errorGeneric');
}

function formatTime(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function QueueItem({
  item,
  onEdit,
}: {
  item: SubmissionRecord;
  onEdit?: (item: SubmissionRecord) => void;
}) {
  const { t, language } = useOfflineMessages();
  const { retry, discard } = useOfflineQueue();
  const [confirmingDiscard, setConfirmingDiscard] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const message = errorMessage(item, t);
  const canRetry = item.state === 'failed' || item.state === 'needs_attention';
  const canEdit = item.state === 'needs_attention' && Boolean(onEdit);
  const uploadedPhotos = Object.keys(item.uploadedPhotoUrls).length;

  const handleRetry = async () => {
    setBusy(true);
    try {
      await retry(item.clientSubmissionId);
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async () => {
    setBusy(true);
    try {
      await discard(item.clientSubmissionId);
    } finally {
      setBusy(false);
      setConfirmingDiscard(false);
    }
  };

  return (
    <li className="rounded-lg border border-border/60 bg-surface p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {item.payload.description || item.clientSubmissionId}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.state === 'sent' ? t('sentAt', { time: formatTime(item.sentAt, language) }) : t('queuedAt', { time: formatTime(item.createdAt, language) })}
          </p>
          {item.referenceNumber && (
            <p className="mt-0.5 text-xs font-mono text-muted-foreground">{t('referenceNumber', { number: item.referenceNumber })}</p>
          )}
          {item.photoIds.length > 0 && item.state !== 'sent' && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('photosUploading', { done: uploadedPhotos, total: item.photoIds.length })}
            </p>
          )}
        </div>
        <SubmissionStateChip state={item.state} />
      </div>

      {message && (
        <p className="mt-2 rounded-md bg-warning-muted px-2 py-1.5 text-xs text-warning-foreground" role="note">
          {message}
        </p>
      )}

      {(canRetry || canEdit || item.state !== 'sent') && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canRetry && (
            <Button type="button" size="sm" variant="secondary" onClick={handleRetry} disabled={busy}>
              <Icon name="refresh" size={14} aria-hidden={true} />
              {t('retry')}
            </Button>
          )}
          {canEdit && (
            <Button type="button" size="sm" variant="secondary" onClick={() => onEdit?.(item)} disabled={busy}>
              <Icon name="pencil" size={14} aria-hidden={true} />
              {t('edit')}
            </Button>
          )}
          {item.state !== 'sent' && !confirmingDiscard && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDiscard(true)} disabled={busy}>
              <Icon name="trash" size={14} aria-hidden={true} />
              {t('discard')}
            </Button>
          )}
        </div>
      )}

      {confirmingDiscard && (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger-muted p-2.5">
          <p className="text-xs font-semibold text-danger-foreground">{t('discardConfirmTitle')}</p>
          <p className="mt-1 text-xs text-danger-foreground/90">{t('discardConfirmBody')}</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" variant="danger" onClick={handleDiscard} disabled={busy}>
              {t('discardConfirmAction')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDiscard(false)} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function OfflineQueueSheet({ open, onOpenChange, onEdit, className }: OfflineQueueSheetProps) {
  const { items, syncing, lastSyncAt, syncNow } = useOfflineQueue();
  const { t, language } = useOfflineMessages();

  const ordered = React.useMemo(
    () => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items]
  );

  return (
    <RightDrawer title={t('queueTitle')} open={open} onOpenChange={onOpenChange} className={className}>
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {lastSyncAt ? t('lastSynced', { time: formatTime(lastSyncAt, language) }) : t('neverSynced')}
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={() => void syncNow()} isLoading={syncing}>
          <Icon name="cached" size={14} aria-hidden={true} />
          {t('syncNow')}
        </Button>
      </div>

      <div aria-live="polite" className="sr-only">
        {syncing ? t('syncing') : ''}
      </div>

      {ordered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('queueEmpty')}</p>
      ) : (
        <ul className="space-y-2 p-4">
          {ordered.map((item) => (
            <QueueItem key={item.clientSubmissionId} item={item} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </RightDrawer>
  );
}
