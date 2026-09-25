import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Standard page heading: optional eyebrow, title, description and actions.
 * Every non-map page starts with one so spacing and hierarchy stay uniform.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Centred content column used by standard pages. */
export function PageContainer({ className, wide, ...props }: React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 pt-6 sm:px-6 sm:pt-8', wide ? 'max-w-[1400px]' : 'max-w-6xl', className)} {...props} />;
}
