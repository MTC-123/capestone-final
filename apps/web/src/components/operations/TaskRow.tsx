'use client';

import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { useTranslation } from '@/hooks/useTranslation';
import type { PhaseChecklistItem } from '@/types/operations';

interface TaskRowProps {
  item: PhaseChecklistItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TaskRow({ item, onToggle, onDelete }: TaskRowProps) {
  const { t } = useTranslation();
  const isDone = item.status === 'DONE';

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
        'hover:bg-muted/40'
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-label={isDone ? t('markPending') : t('markDone')}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all duration-150',
          isDone
            ? 'border-success bg-success text-white'
            : 'border-border hover:border-primary'
        )}
      >
        {isDone && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Task text */}
      <span
        className={cn(
          'flex-1 text-sm transition-all duration-150',
          isDone && 'line-through text-muted-foreground opacity-60'
        )}
      >
        {item.task}
      </span>

      {/* Responsible unit badge */}
      {item.responsibleUnit && (
        <Badge tone="neutral" className="hidden sm:inline-flex text-[10px] px-2 py-0.5">
          {item.responsibleUnit}
        </Badge>
      )}

      {/* Deadline */}
      {item.deadline && (
        <span className="hidden sm:inline text-[11px] text-muted-foreground">
          {new Date(item.deadline).toLocaleDateString()}
        </span>
      )}

      {/* Delete */}
      <IconButton
        label={t('close'as Parameters<typeof t>[0])}
        variant="ghost"
        onClick={() => onDelete(item.id)}
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Icon name="trash" size={14} aria-hidden={true} />
      </IconButton>
    </div>
  );
}
