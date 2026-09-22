'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAnalyticsStore, computeDateRange } from '@/store/useAnalyticsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Card } from '@/components/ui/Card';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { TemporalData } from '@/types/analytics';

export function TemporalPanel() {
  const { t, language } = useTranslation();
  const dateRange = useAnalyticsStore((s) => s.dateRange);
  const customFrom = useAnalyticsStore((s) => s.customFrom);
  const customTo = useAnalyticsStore((s) => s.customTo);
  const [data, setData] = useState<TemporalData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTemporal = useCallback(async () => {
    setLoading(true);
    try {
      const range = computeDateRange(dateRange, customFrom, customTo);
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetchWithAuth(`/api/analytics/temporal?${params.toString()}`);
      if (res.ok) {
        setData(await res.json() as TemporalData);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [dateRange, customFrom, customTo]);

  useEffect(() => {
    fetchTemporal();
  }, [fetchTemporal]);

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--surface))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
  };

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-muted p-6">
            <div className="h-[250px] rounded-xl bg-muted-foreground/10" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  // Monthly heatmap
  const heatmapYears = Array.from(new Set(data.monthlyHeatmap.map((d) => d.year))).sort();
  const maxCount = Math.max(1, ...data.monthlyHeatmap.map((d) => d.count));
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthNames = months.map((m) => {
    const d = new Date(2024, m - 1, 1);
    return d.toLocaleDateString(language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
  });

  const getHeatmapCount = (year: number, month: number) =>
    data.monthlyHeatmap.find((d) => d.year === year && d.month === month)?.count ?? 0;

  const fireLabel = language === 'ar' ? 'حريق' : language === 'fr' ? 'incendie(s)' : 'fire(s)';

  return (
    <div className="space-y-8">
      {/* Monthly Heatmap */}
      {heatmapYears.length > 0 && (
        <Card tone="elevated" className="p-6">
          <h2 className="text-xl font-bold mb-4">{t('firesByMonth')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left text-muted-foreground" />
                  {monthNames.map((name, i) => (
                    <th key={i} className="p-2 text-center text-xs text-muted-foreground">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapYears.map((year) => (
                  <tr key={year}>
                    <td className="p-2 font-semibold text-foreground">{year}</td>
                    {months.map((month) => {
                      const count = getHeatmapCount(year, month);
                      const intensity = count / maxCount;
                      return (
                        <td
                          key={month}
                          className="p-1 text-center"
                          aria-label={`${year}-${String(month).padStart(2, '0')}: ${count} ${fireLabel}`}
                        >
                          <div
                            className="mx-auto h-8 w-full min-w-[2rem] rounded text-xs flex items-center justify-center font-medium"
                            style={{
                              backgroundColor: count > 0
                                ? `rgba(239, 68, 68, ${0.15 + intensity * 0.75})`
                                : 'hsl(var(--muted))',
                              color: intensity > 0.5 ? 'white' : 'hsl(var(--foreground))',
                            }}
                          >
                            {count > 0 ? count : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Hourly Distribution */}
      {data.byHour.length > 0 && (
        <Card tone="elevated" className="p-6">
          <h2 className="text-xl font-bold mb-4">{t('firesByHour')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => `${v}h`}
              />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ${fireLabel}`, '']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.byHour.map((entry) => (
                  <Cell
                    key={entry.hour}
                    fill={entry.hour >= 12 && entry.hour <= 18 ? 'hsl(var(--danger))' : 'hsl(var(--primary))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted-foreground">{t('peakFireHours')}</p>
        </Card>
      )}

      {/* Enhanced Timeline */}
      {data.byDate.length > 0 && (
        <Card tone="elevated" className="p-6">
          <h2 className="text-xl font-bold mb-4">{t('fireEvolution')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.byDate}>
              <defs>
                <linearGradient id="temporalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--danger))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(v) => new Date(v).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR')}
                formatter={(v) => [`${v} ${fireLabel}`, '']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--danger))"
                strokeWidth={2}
                fill="url(#temporalGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
