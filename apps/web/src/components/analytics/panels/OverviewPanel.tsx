'use client';

import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAnalyticsStore } from '@/store/useAnalyticsStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '../EmptyState';

const COLORS = [
  'hsl(var(--danger))',
  'hsl(var(--primary))',
  'hsl(var(--warning))',
  'hsl(38 92% 50%)',
  'hsl(142 71% 45%)',
  'hsl(180 71% 45%)',
  'hsl(200 71% 45%)',
  'hsl(270 71% 55%)',
];

const CAUSE_MAP: Record<string, TranslationKey> = {
  CAMPFIRE_UNATTENDED: 'campfireUnattended',
  CIGARETTE: 'cigarette',
  AGRICULTURAL_BURNING: 'agriculturalBurning',
  ELECTRICAL: 'electrical',
  LIGHTNING: 'lightning',
  ARSON: 'arson',
  EQUIPMENT_MALFUNCTION: 'equipmentMalfunction',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

export function OverviewPanel() {
  const { t, language } = useTranslation();
  const data = useAnalyticsStore((s) => s.data);
  const loading = useAnalyticsStore((s) => s.loading);
  const error = useAnalyticsStore((s) => s.error);

  if (loading) {
    return (
      <div aria-busy="true" aria-label={t('loading')}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-muted p-4 space-y-3">
              <div className="h-4 w-1/3 rounded-xl bg-muted-foreground/10" />
              <div className="h-8 w-1/2 rounded-xl bg-muted-foreground/10" />
            </div>
          ))}
        </div>
        <div className="animate-pulse rounded-xl border border-border bg-muted p-6 mb-8">
          <div className="h-[300px] rounded-xl bg-muted-foreground/10" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-muted px-4 py-3 text-center text-danger-foreground">
        {error}
      </div>
    );
  }

  if (!data || data.stats.totalIncidents === 0) {
    return <EmptyState />;
  }

  const getCauseLabel = (causeKey: string) => t(CAUSE_MAP[causeKey] ?? 'unknown');
  const causesData = data.causes.map((item) => ({
    ...item,
    name: getCauseLabel(item.cause),
  }));

  const countLabel = language === 'ar' ? 'العدد' : language === 'fr' ? 'Nombre' : 'Count';
  const fireLabel = language === 'ar' ? 'حريق' : language === 'fr' ? 'incendie(s)' : 'fire(s)';

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--surface))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
  };

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          label={t('totalFires')}
          value={data.stats.totalIncidents}
          tone="danger"
          icon={<Icon name="fire" aria-hidden size={28} className="text-danger" />}
        />
        <KpiCard
          label={t('daysWithFires')}
          value={data.stats.daysWithFires}
          tone="warning"
          icon={<Icon name="calendar" aria-hidden size={28} className="text-warning" />}
        />
        <KpiCard
          label={t('dailyAverage')}
          value={data.stats.dailyAverage}
          tone="primary"
          icon={<Icon name="analytics" aria-hidden size={28} className="text-primary" />}
        />
        <KpiCard
          label={t('peakHour')}
          value={data.stats.peakHour >= 0 ? `${data.stats.peakHour}:00` : '—'}
          tone="warning"
          icon={<Icon name="calendar" aria-hidden size={28} className="text-warning" />}
        />
      </div>

      {/* Timeline Area Chart */}
      <Card tone="elevated" className="p-6">
        <h2 className="text-xl font-bold mb-4">{t('fireEvolution')}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data.timeline}>
            <defs>
              <linearGradient id="fireGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--danger))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
            />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR');
              }}
              formatter={(value) => [`${value} ${fireLabel}`, countLabel]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--danger))"
              strokeWidth={2}
              fill="url(#fireGradient)"
              dot={{ fill: 'hsl(var(--danger))', r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Bottom row: Causes + Severity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Causes Pie Chart */}
        {causesData.length > 0 && (
          <Card tone="elevated" className="p-6">
            <h2 className="text-xl font-bold mb-4">{t('distributionByCause')}</h2>
            <div className="flex flex-col items-center gap-6">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={causesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    dataKey="count"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {causesData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${value} ${fireLabel}`,
                      props.payload.name,
                    ]}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3">
                {causesData.map((entry, index) => (
                  <div key={entry.cause} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs text-foreground">{entry.name}: {entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Severity Bar Chart */}
        {data.severity.length > 0 && (
          <Card tone="elevated" className="p-6">
            <h2 className="text-xl font-bold mb-4">{t('severityDistribution')}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.severity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="level"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `${t('severity')} ${v}`}
                />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}
