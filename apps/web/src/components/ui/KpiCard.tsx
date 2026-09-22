import * as React from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';

export type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
};

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
}: KpiCardProps) {
  return (
    <Card
      tone="subtle"
      className={cn(
        'p-4',
        tone === 'primary' && 'border-primary/20',
        tone === 'success' && 'border-success/20',
        tone === 'warning' && 'border-warning/20',
        tone === 'danger' && 'border-danger/20',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-2xl font-bold leading-none">{value}</div>
          {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface shadow-sm">
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
