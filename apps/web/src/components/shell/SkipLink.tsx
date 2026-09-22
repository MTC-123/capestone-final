'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';

export function SkipLink({ href = '#main' }: { href?: string }) {
  const { t } = useTranslation();

  return (
    <a
      href={href}
      className={cn(
        'sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[9999]',
        'rounded-md bg-surface px-4 py-2 text-sm font-bold text-foreground shadow-elev-2',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
    >
      {t('skipToContent')}
    </a>
  );
}
