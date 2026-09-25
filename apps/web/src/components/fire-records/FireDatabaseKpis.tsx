'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { KpiCard } from '@/components/ui/KpiCard';
import { Icon } from '@/components/ui/Icon';

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
          <SkeletonBox key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: t('kpiTotalFires' as Parameters<typeof t>[0]),
      value: String(stats.totalFiresThisYear),
      testId: 'kpi-total-fires',
      icon: 'fire' as const,
      tone: 'danger' as const,
    },
    {
      label: t('kpiTotalHectares' as Parameters<typeof t>[0]),
      value: `${stats.totalHectaresBurned} ha`,
      testId: 'kpi-total-hectares',
      icon: 'mountain' as const,
      tone: 'warning' as const,
    },
    {
      label: t('kpiAvgResponseTime' as Parameters<typeof t>[0]),
      value: stats.avgResponseTimeMinutes != null ? `${stats.avgResponseTimeMinutes} min` : '—',
      testId: 'kpi-avg-response',
      icon: 'timer' as const,
      tone: 'primary' as const,
    },
    {
      label: t('kpiMostAffectedCommune' as Parameters<typeof t>[0]),
      value: stats.mostAffectedCommune ? <bdi>{stats.mostAffectedCommune}</bdi> : '—',
      testId: 'kpi-commune',
      icon: 'mapPin' as const,
      tone: 'neutral' as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="fire-database-kpis">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.testId}
          data-testid={kpi.testId}
          label={kpi.label}
          value={kpi.value}
          tone={kpi.tone}
          icon={<Icon name={kpi.icon} aria-hidden size={20} />}
        />
      ))}
    </div>
  );
}
