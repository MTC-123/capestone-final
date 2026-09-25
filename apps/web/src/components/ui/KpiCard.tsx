import * as React from 'react';
import { cn } from '@/lib/cn';

export type KpiCardProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
};

const TONE_ICON_CLASSES: Record<NonNullable<KpiCardProps['tone']>, string> = {
  neutral: 'bg-surface-2 text-muted-foreground',
  primary: 'bg-primary-muted text-primary',
  success: 'bg-success-muted text-success-foreground',
  warning: 'bg-warning-muted text-warning-foreground',
  danger: 'bg-danger-muted text-danger-foreground',
};

/** Stat tile matching the AgencyStatusBoard cards: mono tabular value, icon chip, subtle border. */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
  ...rest
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-elev-1',
        className
      )}
      {...rest}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 truncate font-mono text-2xl font-semibold leading-none tabular">{value}</div>
        </div>
        {icon ? (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONE_ICON_CLASSES[tone])}>
            {icon}
          </div>
        ) : null}
      </div>
      {hint ? <div className="mt-2.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
