'use client';

import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';
import type { OperationalPhase } from '@/types/operations';

type OperationPdfLanguage = 'ar' | 'fr' | 'en';

const PDF_LANGUAGES: Array<{
  lang: OperationPdfLanguage;
  labelKey: 'downloadPdfArabic' | 'downloadPdfFrench' | 'downloadPdfEnglish';
}> = [
  { lang: 'ar', labelKey: 'downloadPdfArabic' },
  { lang: 'fr', labelKey: 'downloadPdfFrench' },
  { lang: 'en', labelKey: 'downloadPdfEnglish' },
];

interface OperationPhasePdfActionsProps {
  campaignId: string;
  phase: OperationalPhase;
  compact?: boolean;
  className?: string;
}

export function OperationPhasePdfActions({
  campaignId,
  phase,
  compact = false,
  className,
}: OperationPhasePdfActionsProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex flex-wrap gap-2', className)} aria-label={t('operationPdfDownloads')}>
      {PDF_LANGUAGES.map((item) => (
        <a
          key={item.lang}
          href={`/api/operations/campaigns/${campaignId}/pdf?phase=${phase}&lang=${item.lang}`}
          download
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-emerald-200',
            !compact && 'min-h-9 gap-2 px-3 text-sm',
          )}
        >
          <Icon name="download" size={compact ? 13 : 15} aria-hidden />
          {t(item.labelKey)}
        </a>
      ))}
    </div>
  );
}
