import * as React from 'react';
import { cn } from '@/lib/cn';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide',
        tone === 'neutral' && 'border-border/60 bg-surface-2 text-foreground',
        tone === 'primary' && 'border-primary/20 bg-primary/10 text-primary',
        tone === 'success' && 'border-success/20 bg-success-muted text-success-foreground',
        tone === 'warning' && 'border-warning/20 bg-warning-muted text-warning-foreground',
        tone === 'danger' && 'border-danger/20 bg-danger-muted text-danger-foreground',
        className
      )}
      {...props}
    />
  );
}
