'use client';

import type { RecordStatus } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

const STATUS_TONE: Record<RecordStatus, NonNullable<BadgeProps['tone']>> = {
  DRAFT: 'warning',
  VERIFIED: 'primary',
  LOCKED: 'success',
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

  return (
    <Badge
      tone={STATUS_TONE[status]}
      className={cn(interactive && 'cursor-pointer hover:ring-2 hover:ring-primary/50')}
      data-testid="record-status-badge"
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
    >
      {t(STATUS_KEYS[status] as Parameters<typeof t>[0])}
    </Badge>
  );
}
