'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { getRiskInfo } from '@/lib/map/riskLevel';
import { Icon } from '@/components/ui/Icon';
import type { WeatherData } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

interface MapStatusBarProps {
  weather: WeatherData | null;
  activeIncidents: number;
  lastUpdated: number | null;
}

export default function MapStatusBar({ weather, activeIncidents, lastUpdated }: MapStatusBarProps) {
  const { t, language } = useTranslation();
  const risk = weather ? getRiskInfo(weather) : null;

  const directionKeys = ['windN', 'windNE', 'windE', 'windSE', 'windS', 'windSW', 'windW', 'windNW'] as const;
  const directionIndex = weather ? Math.round(weather.windDirection / 45) % 8 : 0;
  const windDir = weather ? t(directionKeys[directionIndex]) : '';

  const riskColor = risk?.color ?? '#6b7280';
  const isHighRisk = risk?.labelKey === 'riskEleve' || risk?.labelKey === 'riskExtreme';

  return (
    <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 shadow-glass glass sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:justify-start sm:px-3">
      {/* Risk badge */}
      <div
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${isHighRisk ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: riskColor }}
      >
        <Icon name="warning" size={12} aria-hidden />
        {risk ? t(risk.labelKey as TranslationKey) : '—'}
      </div>

      <div className="h-4 w-px bg-white/20" />

      {/* Active incidents */}
      <div className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-foreground">
        <Icon name="fire" size={14} aria-hidden />
        <span className={activeIncidents > 0 ? 'truncate text-warning font-bold' : 'truncate'}>
          {activeIncidents} {t('activeIncidents')}
        </span>
      </div>

      {weather && (
        <>
          <div className="h-4 w-px bg-white/20 hidden sm:block" />
          {/* Temp + wind compact */}
          <div className="text-[11px] font-medium text-foreground whitespace-nowrap hidden sm:block">
            {weather.temperature}°C | {weather.windSpeed}km/h {windDir}
          </div>
        </>
      )}

      {lastUpdated && (
        <>
          <div className="h-4 w-px bg-white/20 hidden md:block" />
          <div className="text-[10px] text-muted-foreground whitespace-nowrap hidden md:block">
            {new Date(lastUpdated).toLocaleTimeString(
              language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US',
              { hour: '2-digit', minute: '2-digit' }
            )}
          </div>
        </>
      )}

    </div>
  );
}
