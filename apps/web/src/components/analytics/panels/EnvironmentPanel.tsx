'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAnalyticsStore, computeDateRange } from '@/store/useAnalyticsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Card } from '@/components/ui/Card';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { WeatherHistoryData } from '@/types/analytics';
import type { PrecipitationData } from '@/types/analytics';
import type { TranslationKey } from '@/i18n/translations';

export function EnvironmentPanel() {
  const { t, language } = useTranslation();
  const dateRange = useAnalyticsStore((s) => s.dateRange);
  const customFrom = useAnalyticsStore((s) => s.customFrom);
  const customTo = useAnalyticsStore((s) => s.customTo);
  const [data, setData] = useState<WeatherHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [precipData, setPrecipData] = useState<PrecipitationData | null>(null);

  const fetchWeatherHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const range = computeDateRange(dateRange, customFrom, customTo);
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetchWithAuth(`/api/analytics/weather-history?${params.toString()}`);
      if (res.ok) {
        setData(await res.json() as WeatherHistoryData);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateRange, customFrom, customTo]);

  useEffect(() => {
    fetchWeatherHistory();
  }, [fetchWeatherHistory]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/weather/precipitation')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setPrecipData(data as PrecipitationData); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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

  if (error || !data || data.dates.length === 0) {
    return (
      <Card tone="subtle" className="p-8 text-center">
        <p className="text-muted-foreground">{t('insufficientData')}</p>
      </Card>
    );
  }

  // Build chart-friendly arrays
  const chartData = data.dates.map((date, i) => ({
    date,
    tempMax: data.temperatureMax[i],
    precipitation: data.precipitation[i],
    humidity: data.humidityMean[i],
    windMax: data.windSpeedMax[i],
  }));

  const precipChartData = precipData
    ? precipData.dates.map((date, i) => ({
        date,
        precipitation: precipData.precipitation[i],
        cumulative: precipData.cumulative[i],
      }))
    : [];

  const formatDate = (v: string) => {
    const d = new Date(v);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="space-y-8">
      {/* Temperature Trend */}
      <Card tone="elevated" className="p-6">
        <h2 className="text-xl font-bold mb-4">{t('temperatureTrend')}</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--danger))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatDate} />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} unit="°C" />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => new Date(v).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR')} />
            <Area type="monotone" dataKey="tempMax" stroke="hsl(var(--danger))" fill="url(#tempGradient)" strokeWidth={2} name={t('temperature')} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Precipitation — KPIs + Combo Chart */}
      <Card tone="elevated" className="p-6">
        <h2 className="text-xl font-bold mb-4">{t('precipitationTrend')}</h2>
        {precipData && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-center">
              <div className="text-2xl font-bold text-primary">{precipData.stats.rainfall30d}<span className="text-sm font-normal ml-0.5">mm</span></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t('rainfall30d' as TranslationKey)}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-center">
              <div className="text-2xl font-bold text-amber-500">{precipData.stats.daysSinceRain}<span className="text-sm font-normal ml-0.5">d</span></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t('daysSinceRain' as TranslationKey)}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-center">
              <div className="text-2xl font-bold text-danger">{precipData.stats.deficitPercent}<span className="text-sm font-normal ml-0.5">%</span></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t('precipitationDeficit' as TranslationKey)}</div>
            </div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={precipData ? precipChartData : chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatDate} />
            <YAxis yAxisId="left" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} unit="mm" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} unit="mm" />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => new Date(v).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR')} />
            <Bar yAxisId="left" dataKey="precipitation" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t('dailyPrecipitation' as TranslationKey)} />
            {precipData && <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="hsl(var(--danger))" strokeWidth={2} dot={false} name={t('cumulativePrecipitation' as TranslationKey)} />}
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Humidity Trend */}
      <Card tone="elevated" className="p-6">
        <h2 className="text-xl font-bold mb-4">{t('humidityTrend')}</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatDate} />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} unit="%" domain={[0, 100]} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => new Date(v).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR')} />
            <Line type="monotone" dataKey="humidity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name={t('humidity')} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

    </div>
  );
}
