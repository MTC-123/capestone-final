'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { PageContainer, PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/analytics/DateRangeSelector';
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs';

export default function AnalyticsPage() {
  const { t } = useTranslation();

  return (
    <PageContainer wide className="page-enter pb-10">
      <PageHeader title={t('analyticsTitle')} description={t('analyticsDescNew')} />

      <DateRangeSelector />
      <AnalyticsTabs />
    </PageContainer>
  );
}
