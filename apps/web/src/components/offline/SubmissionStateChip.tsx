'use client';

import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { useOfflineMessages, type OfflineMessageKey } from '@/lib/offline/messages';
import type { SubmissionState } from '@/lib/offline/types';

const TONE: Record<SubmissionState, NonNullable<BadgeProps['tone']>> = {
  saved: 'neutral',
  pending: 'primary',
  sent: 'success',
  failed: 'danger',
  needs_attention: 'warning',
};

const DOT: Record<SubmissionState, string> = {
  saved: 'bg-muted-foreground',
  pending: 'bg-primary',
  sent: 'bg-success',
  failed: 'bg-danger',
  needs_attention: 'bg-warning',
};

const MESSAGE_KEY: Record<SubmissionState, OfflineMessageKey> = {
  saved: 'stateSaved',
  pending: 'statePending',
  sent: 'stateSent',
  failed: 'stateFailed',
  needs_attention: 'stateNeedsAttention',
};

export interface SubmissionStateChipProps {
  state: SubmissionState;
  className?: string;
}

/**
 * Status is conveyed by the label text (translated), not by colour alone —
 * the dot is purely decorative (aria-hidden) reinforcement.
 */
export function SubmissionStateChip({ state, className }: SubmissionStateChipProps) {
  const { t } = useOfflineMessages();
  return (
    <Badge tone={TONE[state]} className={cn('shrink-0', className)}>
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT[state])} />
      {t(MESSAGE_KEY[state])}
    </Badge>
  );
}
