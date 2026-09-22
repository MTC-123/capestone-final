'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { SkeletonCard } from '@/components/ui/Skeleton';

export function FireDatabaseKpis() {
  const { t } = useTranslation();
  const { stats, statsLoading, fetchStats } = useFireRecordStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (statsLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="kpi-skeleton">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: t('kpiTotalFires' as Parameters<typeof t>[0]),
      value: String(stats.totalFiresThisYear),
      testId: 'kpi-total-fires',
    },
    {
      label: t('kpiTotalHectares' as Parameters<typeof t>[0]),
      value: `${stats.totalHectaresBurned} ha`,
      testId: 'kpi-total-hectares',
    },
    {
      label: t('kpiAvgResponseTime' as Parameters<typeof t>[0]),
      value: stats.avgResponseTimeMinutes != null ? `${stats.avgResponseTimeMinutes} min` : '—',
      testId: 'kpi-avg-response',
    },
    {
      label: t('kpiMostAffectedCommune' as Parameters<typeof t>[0]),
      value: stats.mostAffectedCommune ?? '—',
      testId: 'kpi-commune',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="fire-database-kpis">
      {kpis.map((kpi) => (
        <div
          key={kpi.testId}
          className="rounded-lg border border-border bg-surface p-3 shadow-sm"
          data-testid={kpi.testId}
        >
          <p className="text-xs text-muted-foreground">{kpi.label}</p>
          <p className="mt-1 text-lg font-bold">{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}
