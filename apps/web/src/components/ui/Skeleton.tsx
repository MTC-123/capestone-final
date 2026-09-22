'use client';

import { cn } from '@/lib/cn';

export function SkeletonBox({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-muted', className)}
    />
  );
}

export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 animate-pulse rounded-lg bg-muted',
            i === lines - 1 && lines > 1 && 'w-3/4'
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xl border border-border/40 bg-surface p-4 space-y-3', className)}
    >
      <div className="h-4 w-1/3 rounded-lg bg-muted" />
      <div className="h-8 w-1/2 rounded-lg bg-muted" />
      <div className="h-3 w-2/3 rounded-lg bg-muted" />
    </div>
  );
}
