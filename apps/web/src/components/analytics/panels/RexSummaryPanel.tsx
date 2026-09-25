'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { Icon } from '@/components/ui/Icon';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { useTranslation } from '@/hooks/useTranslation';

interface RexSummary {
  total: number;
  infrastructure: {
    noPistes: number;
    noTranchees: number;
    noPointsEau: number;
  };
  recentLessons: { id: string; date: string; text: string }[];
}

export function RexSummaryPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState<RexSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/debriefings/summary');
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('rexErrorGeneric'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('loading')}>
        <SkeletonBox className="h-20 rounded-2xl" />
        <SkeletonBox className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger-muted px-4 py-3 text-center text-sm text-danger-foreground">
        {error}
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card tone="subtle" className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{t('rexNoData')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t('rexDebriefingsCompleted')}
          value={data.total}
          tone="primary"
          icon={<Icon name="clipboard" aria-hidden size={24} className="text-primary" />}
        />
        <KpiCard
          label={t('rexNoPistes')}
          value={`${data.infrastructure.noPistes}%`}
          tone="warning"
          icon={<Icon name="route" aria-hidden size={24} className="text-warning" />}
        />
        <KpiCard
          label={t('rexNoTranchees')}
          value={`${data.infrastructure.noTranchees}%`}
          tone="warning"
          icon={<Icon name="shield" aria-hidden size={24} className="text-warning" />}
        />
        <KpiCard
          label={t('rexNoPointsEau')}
          value={`${data.infrastructure.noPointsEau}%`}
          tone="danger"
          icon={<Icon name="droplet" aria-hidden size={24} className="text-danger" />}
        />
      </div>

      {/* Recent lessons */}
      <Card tone="elevated" className="p-6">
        <h3 className="text-sm font-bold text-foreground mb-4">
          {t('rexRecentLessons')}
        </h3>
        {data.recentLessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('rexNoLessons')}</p>
        ) : (
          <ul className="space-y-3">
            {data.recentLessons.map((lesson) => (
              <li key={lesson.id} className="flex gap-3 text-sm">
                <span className="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular">
                  {lesson.date}
                </span>
                <span className="text-foreground">
                  <bdi>{lesson.text}</bdi>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
