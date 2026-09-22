'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';

export type SearchInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className={cn('relative block', className)}>
        <span className="sr-only">{label}</span>
        <Icon
          name="search"
          aria-hidden={true}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={20}
        />
        <input
          ref={ref}
          className={cn(
            'h-10 w-full rounded-md border border-border bg-surface px-10 text-sm text-foreground shadow-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          )}
          {...props}
        />
      </label>
    );
  }
);

SearchInput.displayName = 'SearchInput';
