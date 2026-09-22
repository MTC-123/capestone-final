import * as React from 'react';
import { cn } from '@/lib/cn';

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical';
};

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'bg-border',
        orientation === 'horizontal' && 'h-px w-full',
        orientation === 'vertical' && 'h-full w-px',
        className
      )}
      {...props}
    />
  );
}
