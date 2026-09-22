import * as React from 'react';
import { cn } from '@/lib/cn';

export type TopbarProps = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};

export function Topbar({ left, center, right, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-16 w-full items-center glass',
        'border-b border-border/50 dark:border-border/30',
        className
      )}
    >
      <div className="mx-auto flex w-full items-center gap-3 px-3 sm:gap-4 sm:px-4">
        <div className="flex flex-1 items-center gap-3 min-w-0">{left}</div>
        <div className="hidden min-w-0 flex-[2] items-center justify-center md:flex">
          {center}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">{right}</div>
      </div>
    </header>
  );
}
