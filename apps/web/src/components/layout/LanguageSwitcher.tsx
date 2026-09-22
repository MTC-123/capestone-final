'use client';

import * as React from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguageStore();
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('language')}
      className="flex items-center gap-1 rounded-md border border-border bg-surface-2 p-1 shadow-sm"
    >
      <button
        onClick={() => setLanguage('ar')}
        aria-pressed={language === 'ar'}
        className={cn(
          'h-9 rounded-md border border-transparent px-3 text-sm font-bold transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          language === 'ar'
            ? 'border-success/30 bg-primary-muted text-success-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        العربية
      </button>
      <button
        onClick={() => setLanguage('fr')}
        aria-pressed={language === 'fr'}
        className={cn(
          'h-9 rounded-md border border-transparent px-3 text-sm font-bold transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          language === 'fr'
            ? 'border-success/30 bg-primary-muted text-success-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        Français
      </button>
      <button
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={cn(
          'h-9 rounded-md border border-transparent px-3 text-sm font-bold transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          language === 'en'
            ? 'border-success/30 bg-primary-muted text-success-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        English
      </button>
    </div>
  );
}
