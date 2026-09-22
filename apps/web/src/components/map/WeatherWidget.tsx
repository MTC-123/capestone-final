'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getRiskInfo } from '@/lib/map/riskLevel';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { WeatherData } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  loading?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const WIND_DIRECTION_KEYS = ['windN', 'windNE', 'windE', 'windSE', 'windS', 'windSW', 'windW', 'windNW'] as const;

export default function WeatherWidget({
  weather,
  loading,
  mobileOpen = false,
  onMobileOpenChange,
}: WeatherWidgetProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const risk = weather ? getRiskInfo(weather) : null;

  if (!weather && !loading) return null;

  const directionIndex = weather ? Math.round(weather.windDirection / 45) % 8 : 0;
  const windDir = weather ? t(WIND_DIRECTION_KEYS[directionIndex]) : '';

  const compactSummary = weather
    ? `${weather.temperature}°C | ${weather.windSpeed} km/h ${windDir}`
    : '…';

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          aria-hidden="true"
          onPointerDown={() => onMobileOpenChange?.(false)}
        />
      )}
      <div
        data-testid="map-weather-panel"
        className={cn(
          'z-10 w-auto min-w-0',
          mobileOpen
            ? 'fixed inset-x-2 bottom-[calc(var(--mobile-tabbar-height)+0.75rem)] z-50 md:hidden'
            : 'absolute top-16 hidden max-w-[calc(100%-1.5rem)] ltr:right-3 rtl:left-3 md:block sm:min-w-[160px]'
        )}
      >
      <GlassPanel
        title={expanded ? t('weatherTitle' as TranslationKey) : compactSummary}
        collapsible
        defaultCollapsed={false}
        onCollapsedChange={(c) => setExpanded(!c)}
      >
        {weather && (
          <div className="border-t border-white/10 px-3 pb-3 pt-2 space-y-2">
            {/* Temperature large */}
            <div className="text-center">
              <div className="text-2xl font-extrabold tracking-tight">{weather.temperature}°C</div>
              {weather.humidity != null && (
                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                  <Icon name="droplet" size={11} aria-hidden />
                  {t('humidity' as TranslationKey) || 'Humidity'}: {weather.humidity}%
                </div>
              )}
            </div>

            {/* Wind */}
            <div className="flex items-center justify-center gap-2">
              <span style={{ transform: `rotate(${weather.windDirection}deg)`, display: 'inline-flex' }}>
                <Icon
                  name="air"
                  size={20}
                  className="text-primary"
                  aria-hidden
                />
              </span>
              <div>
                <div className="text-sm font-bold">{weather.windSpeed} km/h</div>
                <div className="text-[10px] text-muted-foreground">{weather.windDirection}° {windDir}</div>
              </div>
            </div>

            {/* Fire danger gauge */}
            {risk && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  {t('fireRiskLevel' as TranslationKey) || 'Fire Risk'}
                </div>
                {/* Gradient bar */}
                <div className="relative h-2 w-full rounded-full overflow-hidden" style={{
                  background: 'linear-gradient(to right, #22c55e, #84cc16, #f59e0b, #ef4444, #991b1b)'
                }}>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-3.5 w-1 rounded-full bg-white shadow-md border border-black/20"
                    style={{ left: `${Math.min(risk.score * 100, 98)}%` }}
                  />
                </div>
                <div className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: `${risk.color}20` }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: risk.color }} />
                  <span className="text-[11px] font-bold" style={{ color: risk.color }}>
                    {t(risk.labelKey as TranslationKey)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">({(risk.score * 100).toFixed(0)}%)</span>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassPanel>
      </div>
    </>
  );
}
