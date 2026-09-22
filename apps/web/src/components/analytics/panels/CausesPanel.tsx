'use client';

import {
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
  Legend,
} from 'recharts';
import { useAnalyticsStore } from '@/store/useAnalyticsStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import { Card } from '@/components/ui/Card';
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

type CauseCategory = 'humanIntentional' | 'humanAccidental' | 'naturalCause' | 'unknownCause';

const CAUSE_CATEGORIES: Record<string, CauseCategory> = {
  ARSON: 'humanIntentional',
  CAMPFIRE_UNATTENDED: 'humanAccidental',
  CIGARETTE: 'humanAccidental',
  AGRICULTURAL_BURNING: 'humanAccidental',
  ELECTRICAL: 'humanAccidental',
  EQUIPMENT_MALFUNCTION: 'humanAccidental',
  LIGHTNING: 'naturalCause',
  OTHER: 'unknownCause',
  UNKNOWN: 'unknownCause',
};

const CATEGORY_COLORS: Record<CauseCategory, string> = {
  humanIntentional: 'hsl(var(--danger))',
  humanAccidental: 'hsl(var(--warning))',
  naturalCause: 'hsl(var(--primary))',
  unknownCause: 'hsl(var(--muted-foreground))',
};

export function CausesPanel() {
  const { t, language } = useTranslation();
  const data = useAnalyticsStore((s) => s.data);
  const loading = useAnalyticsStore((s) => s.loading);

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-muted p-6">
            <div className="h-[300px] rounded-xl bg-muted-foreground/10" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.stats.totalIncidents === 0) {
    return <EmptyState />;
  }

  const getCauseLabel = (key: string) => t(CAUSE_MAP[key] ?? 'unknown');
  const fireLabel = language === 'ar' ? 'حريق' : language === 'fr' ? 'incendie(s)' : 'fire(s)';

  const causesData = data.causes.map((item) => ({
    ...item,
    name: getCauseLabel(item.cause),
  }));

  // Group by category
  const categoryMap: Record<CauseCategory, number> = {
    humanIntentional: 0,
    humanAccidental: 0,
    naturalCause: 0,
    unknownCause: 0,
  };
  for (const item of data.causes) {
    const cat = CAUSE_CATEGORIES[item.cause] ?? 'unknownCause';
    categoryMap[cat] += item.count;
  }
  const categoryData = (Object.entries(categoryMap) as [CauseCategory, number][])
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({
      category: key,
      name: t(key as TranslationKey),
      count,
      color: CATEGORY_COLORS[key],
    }));

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--surface))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
  };

  return (
    <div className="space-y-8">
      {/* Causes Pie Chart */}
      <Card tone="elevated" className="p-6">
        <h2 className="text-xl font-bold mb-4">{t('causeBreakdown')}</h2>
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={causesData}
                cx="50%"
                cy="50%"
                labelLine
                outerRadius={120}
                dataKey="count"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
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
          <div className="space-y-2 min-w-[200px]">
            {causesData.map((entry, index) => (
              <div key={entry.cause} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-foreground">
                  {entry.name}: {entry.count} ({((entry.count / data.stats.totalIncidents) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Cause Categories Bar Chart */}
      {categoryData.length > 0 && (
        <Card tone="elevated" className="p-6">
          <h2 className="text-xl font-bold mb-4">{t('causeCategory')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                width={150}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ${fireLabel}`, '']} />
              <Legend />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {categoryData.map((entry) => (
                  <Cell key={entry.category} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Category table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left text-muted-foreground">{t('causeCategory')}</th>
                  <th className="p-2 text-left text-muted-foreground">{t('totalFires')}</th>
                  <th className="p-2 text-left text-muted-foreground">{t('causePercentage')}</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map((cat) => (
                  <tr key={cat.category} className="border-b border-border/50">
                    <td className="p-2 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </td>
                    <td className="p-2 font-semibold">{cat.count}</td>
                    <td className="p-2">
                      {((cat.count / data.stats.totalIncidents) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
