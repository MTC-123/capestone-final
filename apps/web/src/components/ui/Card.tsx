import * as React from 'react';
import { cn } from '@/lib/cn';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: 'default' | 'elevated' | 'subtle';
};

export function Card({ className, tone = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-surface text-foreground transition-shadow duration-200',
        tone === 'default' && 'shadow-elev-1',
        tone === 'elevated' && 'shadow-elev-2 hover:shadow-elev-3',
        tone === 'subtle' && 'bg-surface/70 shadow-sm border-border/40',
        className
      )}
      {...props}
    />
  );
}
