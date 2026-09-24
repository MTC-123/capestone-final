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
  const { t, language } = useTranslation();
  const isDone = item.status === 'DONE';
  const dateLocale = { ar: 'ar-MA', fr: 'fr-MA', en: 'en-GB' }[language];

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
        'hover:bg-surface-2'
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        onClick={() => onToggle(item.id)}
        aria-label={`${isDone ? t('markPending') : t('markDone')}: ${item.task}`}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isDone ? 'border-success bg-success text-white' : 'border-input hover:border-primary'
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
          'min-w-0 flex-1 text-start text-sm leading-snug transition-colors duration-150',
          isDone && 'text-muted-foreground line-through decoration-muted-foreground/60'
        )}
      >
        <bdi>{item.task}</bdi>
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
          {new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' }).format(new Date(item.deadline))}
        </span>
      )}

      {/* Delete */}
      <IconButton
        label={`${t('delete' as Parameters<typeof t>[0])}: ${item.task}`}
        variant="ghost"
        onClick={() => onDelete(item.id)}
        className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <Icon name="trash" size={14} aria-hidden={true} />
      </IconButton>
    </div>
  );
}
