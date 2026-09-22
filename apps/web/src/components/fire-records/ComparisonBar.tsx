'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { Button } from '@/components/ui/Button';

export function ComparisonBar() {
  const { t } = useTranslation();
  const { comparisonIds, comparisonLoading, fetchComparison, clearComparison } = useFireRecordStore();

  if (comparisonIds.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2"
      data-testid="comparison-bar"
    >
      <span className="text-sm font-medium">
        {comparisonIds.length} {t('recordsSelected' as Parameters<typeof t>[0])}
      </span>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
        <Button
          variant="secondary"
          size="sm"
          onClick={clearComparison}
        >
          {t('cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={comparisonIds.length < 2 || comparisonLoading}
          onClick={fetchComparison}
        >
          {comparisonLoading ? t('loading') : t('compare' as Parameters<typeof t>[0])}
        </Button>
      </div>
    </div>
  );
}
