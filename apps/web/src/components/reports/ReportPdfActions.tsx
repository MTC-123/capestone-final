'use client';

import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';

type ReportPdfLanguage = 'ar' | 'fr' | 'en';

const PDF_LANGUAGES: Array<{ lang: ReportPdfLanguage; labelKey: 'downloadPdfArabic' | 'downloadPdfFrench' | 'downloadPdfEnglish' }> = [
  { lang: 'ar', labelKey: 'downloadPdfArabic' },
  { lang: 'fr', labelKey: 'downloadPdfFrench' },
  { lang: 'en', labelKey: 'downloadPdfEnglish' },
];

interface ReportPdfActionsProps {
  reportId: string;
  compact?: boolean;
  className?: string;
}

export function ReportPdfActions({ reportId, compact = false, className }: ReportPdfActionsProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex flex-wrap gap-2', className)} aria-label={t('reportPdfDownloads')}>
      {PDF_LANGUAGES.map((item) => (
        <a
          key={item.lang}
          href={`/api/reports/${reportId}/pdf?lang=${item.lang}`}
          download
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border/60 bg-surface-2 px-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            compact && 'min-h-8 px-2.5 text-xs'
          )}
        >
          <Icon name="download" size={compact ? 14 : 16} aria-hidden />
          {t(item.labelKey)}
        </a>
      ))}
    </div>
  );
}
