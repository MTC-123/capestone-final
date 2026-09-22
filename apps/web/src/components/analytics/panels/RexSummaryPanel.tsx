'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { Icon } from '@/components/ui/Icon';

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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-muted px-4 py-3 text-center text-sm text-danger-foreground">
        {error}
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card tone="subtle" className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Aucun débriefing enregistré.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Débriefings complétés"
          value={data.total}
          tone="primary"
          icon={<Icon name="clipboard" aria-hidden size={24} className="text-primary" />}
        />
        <KpiCard
          label="Sans pistes forestières"
          value={`${data.infrastructure.noPistes}%`}
          tone="warning"
          icon={<Icon name="route" aria-hidden size={24} className="text-warning" />}
        />
        <KpiCard
          label="Sans tranchées pare-feu"
          value={`${data.infrastructure.noTranchees}%`}
          tone="warning"
          icon={<Icon name="shield" aria-hidden size={24} className="text-warning" />}
        />
        <KpiCard
          label="Sans points d'eau"
          value={`${data.infrastructure.noPointsEau}%`}
          tone="danger"
          icon={<Icon name="droplet" aria-hidden size={24} className="text-danger" />}
        />
      </div>

      {/* Recent lessons */}
      <Card tone="elevated" className="p-6">
        <h3 className="text-sm font-bold text-foreground mb-4">
          Dernières leçons apprises
        </h3>
        {data.recentLessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune leçon enregistrée.</p>
        ) : (
          <ul className="space-y-3">
            {data.recentLessons.map((lesson) => (
              <li key={lesson.id} className="flex gap-3 text-sm">
                <span className="shrink-0 text-xs text-muted-foreground pt-0.5">
                  {lesson.date}
                </span>
                <span className="text-foreground">{lesson.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
