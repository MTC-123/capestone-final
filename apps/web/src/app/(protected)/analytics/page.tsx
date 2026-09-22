'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { DateRangeSelector } from '@/components/analytics/DateRangeSelector';
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs';

export default function AnalyticsPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 page-enter">
      <div className="mb-6">
        <h1 className="text-fluid-3xl font-bold text-foreground mb-1">
          {t('analyticsTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('analyticsDescNew')}</p>
      </div>

      <DateRangeSelector />
      <AnalyticsTabs />
    </div>
  );
}
