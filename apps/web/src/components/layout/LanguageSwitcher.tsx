'use client';

import * as React from 'react';
import { useLanguageStore, type Language } from '@/store/useLanguageStore';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';

const OPTIONS: { value: Language; short: string; long: string }[] = [
  { value: 'ar', short: 'ع', long: 'العربية' },
  { value: 'fr', short: 'FR', long: 'Français' },
  { value: 'en', short: 'EN', long: 'English' },
];

export default function LanguageSwitcher({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  const { language, setLanguage } = useLanguageStore();
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('language')}
      className={cn('inline-flex items-center rounded-lg border border-border bg-surface-2/70 p-0.5', className)}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          onClick={() => setLanguage(option.value)}
          aria-pressed={language === option.value}
          aria-label={option.long}
          className={cn(
            'rounded-md font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            size === 'sm' ? 'h-7 min-w-[2rem] px-2 text-[11px]' : 'h-8 min-w-[2.5rem] px-2.5 text-xs',
            language === option.value
              ? 'bg-surface text-foreground shadow-elev-1'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span aria-hidden>{size === 'sm' ? option.short : option.long}</span>
        </button>
      ))}
    </div>
  );
}
