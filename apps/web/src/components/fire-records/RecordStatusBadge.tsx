'use client';

import type { RecordStatus } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

const STATUS_STYLES: Record<RecordStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  VERIFIED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  LOCKED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const STATUS_KEYS: Record<RecordStatus, string> = {
  DRAFT: 'fireRecordDraft',
  VERIFIED: 'fireRecordVerified',
  LOCKED: 'fireRecordLocked',
};

interface RecordStatusBadgeProps {
  status: RecordStatus;
  interactive?: boolean;
  onClick?: () => void;
}

export function RecordStatusBadge({ status, interactive, onClick }: RecordStatusBadgeProps) {
  const { t } = useTranslation();

  const className = [
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
    STATUS_STYLES[status],
    interactive ? 'cursor-pointer hover:ring-2 hover:ring-primary/50' : '',
  ].join(' ');

  return (
    <span
      className={className}
      data-testid="record-status-badge"
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
    >
      {t(STATUS_KEYS[status] as Parameters<typeof t>[0])}
    </span>
  );
}
