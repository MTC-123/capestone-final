'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WeatherData } from '@/types';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

export default function WeatherPage() {
  const { t, language } = useTranslation();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWeather = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/weather');
      if (!response.ok) throw new Error('Failed to fetch weather');
      const data = await response.json();
      setWeather(data);
    } catch {
      setError('weatherLoadFailed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 page-enter" aria-busy="true" aria-label={t('loading')}>
        <div className="mb-8">
          <div className="mb-2 h-9 w-full max-w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-5 w-full max-w-96 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 stagger-children">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-surface border border-border/40 p-5 shadow-elev-1">
              <div className="flex items-center justify-between mb-4">
                <div className="h-11 w-11 rounded-xl bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-20 rounded-lg bg-muted" />
                  <div className="h-10 w-16 rounded-lg bg-muted" />
                </div>
              </div>
              <div className="h-4 w-12 rounded-lg bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-8 animate-pulse rounded-xl bg-surface border border-border/40 p-6">
          <div className="flex items-start gap-4">
            <div className="h-7 w-7 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 rounded-lg bg-muted" />
              <div className="h-4 w-full rounded-lg bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 page-enter">
        <Card tone="elevated" className="p-8 text-center">
          <div className="mb-3 flex justify-center text-danger">
            <Icon name="warning" aria-hidden={true} size={36} />
          </div>
          <p className="text-muted-foreground">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {error ? t(error as any) : t('weatherLoadFailed')}
          </p>
        </Card>
      </div>
    );
  }

  const directionKeys = ['windN', 'windNE', 'windE', 'windSE', 'windS', 'windSW', 'windW', 'windNW'] as const;
  const directionIndex = Math.round(weather.windDirection / 45) % 8;
  const windDirectionText = t(directionKeys[directionIndex]);
  const isRTL = language === 'ar';
  const textAlign = isRTL ? 'text-right' : 'text-left';

  const weatherCards = [
    {
      icon: 'thermostat' as const,
      label: t('temperature'),
      value: `${weather.temperature}°`,
      unit: t('temperatureUnit'),
      color: 'text-danger' as const,
      bgColor: 'bg-danger/10' as const,
    },
    {
      icon: 'air' as const,
      label: t('windSpeed'),
      value: String(weather.windSpeed),
      unit: t('windSpeedUnit'),
      color: 'text-info' as const,
      bgColor: 'bg-info/10' as const,
    },
    {
      icon: 'compass' as const,
      label: t('windDirection'),
      value: windDirectionText,
      unit: `${weather.windDirection}°`,
      color: 'text-success' as const,
      bgColor: 'bg-success/10' as const,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 page-enter">
      <div className="mb-6 md:mb-8">
        <h1 className={`text-fluid-3xl font-bold text-foreground mb-1 ${textAlign}`}>{t('weatherTitle')}</h1>
        <p className={`text-sm text-muted-foreground ${textAlign}`}>{t('weatherSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 stagger-children">
        {weatherCards.map((card) => (
          <Card key={card.icon} tone="elevated" className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className={`${card.bgColor} ${card.color} h-11 w-11 rounded-xl grid place-items-center`}>
                <Icon name={card.icon} aria-hidden={true} size={24} />
              </span>
              <div className={`${textAlign} min-w-0`}>
                <div className="text-xs font-medium text-muted-foreground mb-0.5">{card.label}</div>
                <div className={`break-words text-2xl font-bold sm:text-3xl ${card.color}`}>
                  {card.value}
                </div>
              </div>
            </div>
            <div className={`text-xs text-muted-foreground ${textAlign}`}>{card.unit}</div>
          </Card>
        ))}
      </div>

      {/* Weather Alert */}
      <Card tone="elevated" className="mt-6 md:mt-8 p-5 border-warning/20 bg-warning-muted/30 dark:bg-warning-muted/20">
        <div className="flex items-start gap-3">
          <span className="text-warning shrink-0 mt-0.5">
            <Icon name="warning" aria-hidden={true} size={22} />
          </span>
          <div className={`flex-1 ${textAlign}`}>
            <h3 className="font-bold text-foreground mb-1">{t('windAlertTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {weather.windSpeed > 20
                ? t('windAlertHigh')
                : weather.temperature > 30
                ? t('windAlertHot')
                : t('windAlertOk')}
            </p>
          </div>
        </div>
      </Card>

      {/* Last Update */}
      <div className="mt-6 text-center text-xs text-muted-foreground">
        {t('lastUpdatedLabel')}: {new Date(weather.timestamp).toLocaleString(language === 'ar' ? 'ar-MA' : 'fr-FR')}
      </div>
    </div>
  );
}
