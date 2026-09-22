'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { TextField } from './FieldEditor';
import { SectionLockButton } from './SectionLockButton';
import type { ResponseDetail, WeatherAtTime } from '@/types/fire-record';
import type { FireEventRecord } from '@/types';

interface Props {
  recordId: string;
  record: FireEventRecord;
  responseData: ResponseDetail | null;
  weatherData: WeatherAtTime | null;
  isLocked: boolean;
  isReadOnly: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onLocked: () => void;
}

export function ResponseTab({ recordId, record, responseData, weatherData, isLocked, isReadOnly, onSave, onLocked }: Props) {
  const { t } = useTranslation();
  const disabled = isLocked || isReadOnly;

  const [resp, setResp] = useState<ResponseDetail>({
    vehicleCount: responseData?.vehicleCount,
    aircraftCount: responseData?.aircraftCount,
    personnelCount: responseData?.personnelCount,
    waterVolumeLiters: responseData?.waterVolumeLiters,
    retardantVolumeLiters: responseData?.retardantVolumeLiters,
    responseTimeMinutes: responseData?.responseTimeMinutes,
    poiLevel: responseData?.poiLevel,
    saciComplexity: responseData?.saciComplexity,
  });

  const [weather, setWeather] = useState<WeatherAtTime>({
    temperatureC: weatherData?.temperatureC,
    humidityPct: weatherData?.humidityPct,
    windSpeedKmh: weatherData?.windSpeedKmh,
    windDirection: weatherData?.windDirection ?? '',
    daysSinceRain: weatherData?.daysSinceRain,
  });

  const [timeline, setTimeline] = useState({
    alertReceivedAt: record.alertReceivedAt ? toLocalInput(record.alertReceivedAt) : '',
    ignitionAt: record.ignitionAt ? toLocalInput(record.ignitionAt) : '',
    firstResponseAt: record.firstResponseAt ? toLocalInput(record.firstResponseAt) : '',
    onSceneAt: record.onSceneAt ? toLocalInput(record.onSceneAt) : '',
    containedAt: record.containedAt ? toLocalInput(record.containedAt) : '',
    extinguishedAt: record.extinguishedAt ? toLocalInput(record.extinguishedAt) : '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setResp({
      vehicleCount: responseData?.vehicleCount,
      aircraftCount: responseData?.aircraftCount,
      personnelCount: responseData?.personnelCount,
      waterVolumeLiters: responseData?.waterVolumeLiters,
      retardantVolumeLiters: responseData?.retardantVolumeLiters,
      responseTimeMinutes: responseData?.responseTimeMinutes,
      poiLevel: responseData?.poiLevel,
      saciComplexity: responseData?.saciComplexity,
    });
  }, [responseData]);

  useEffect(() => {
    setWeather({
      temperatureC: weatherData?.temperatureC,
      humidityPct: weatherData?.humidityPct,
      windSpeedKmh: weatherData?.windSpeedKmh,
      windDirection: weatherData?.windDirection ?? '',
      daysSinceRain: weatherData?.daysSinceRain,
    });
  }, [weatherData]);

  const setRespNum = (field: keyof ResponseDetail, val: string) => {
    setResp((f) => ({ ...f, [field]: val ? parseFloat(val) : undefined }));
  };

  const setWeatherNum = (field: keyof WeatherAtTime, val: string) => {
    setWeather((f) => ({ ...f, [field]: val ? parseFloat(val) : undefined }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fields: Record<string, unknown> = {
        responseDetail: resp,
        weatherAtTime: weather,
      };
      // Include timeline fields
      for (const [key, val] of Object.entries(timeline)) {
        if (val) fields[key] = new Date(val).toISOString();
        else fields[key] = null;
      }
      await onSave(fields);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4" data-testid="response-tab" role="tabpanel" id="panel-response">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{t('tabResponse' as Parameters<typeof t>[0])}</h3>
        <SectionLockButton recordId={recordId} section="response" isLocked={isLocked} disabled={isReadOnly} onLocked={onLocked} />
      </div>

      {/* Timeline */}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('fireRecordTimeline')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <TextField label={t('fireRecordAlertReceived')} value={timeline.alertReceivedAt} onChange={(v) => setTimeline((f) => ({ ...f, alertReceivedAt: v }))} disabled={disabled} type="datetime-local" />
          <TextField label={t('ignitionAt' as Parameters<typeof t>[0])} value={timeline.ignitionAt} onChange={(v) => setTimeline((f) => ({ ...f, ignitionAt: v }))} disabled={disabled} type="datetime-local" />
          <TextField label={t('fireRecordFirstResponse')} value={timeline.firstResponseAt} onChange={(v) => setTimeline((f) => ({ ...f, firstResponseAt: v }))} disabled={disabled} type="datetime-local" />
          <TextField label={t('fireRecordOnScene')} value={timeline.onSceneAt} onChange={(v) => setTimeline((f) => ({ ...f, onSceneAt: v }))} disabled={disabled} type="datetime-local" />
          <TextField label={t('fireRecordContained')} value={timeline.containedAt} onChange={(v) => setTimeline((f) => ({ ...f, containedAt: v }))} disabled={disabled} type="datetime-local" />
          <TextField label={t('fireRecordExtinguished')} value={timeline.extinguishedAt} onChange={(v) => setTimeline((f) => ({ ...f, extinguishedAt: v }))} disabled={disabled} type="datetime-local" />
        </div>
      </div>

      {/* Resources */}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('fireRecordMeansEngaged')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <TextField label={t('vehicleCount' as Parameters<typeof t>[0])} value={resp.vehicleCount != null ? String(resp.vehicleCount) : ''} onChange={(v) => setRespNum('vehicleCount', v)} disabled={disabled} type="number" />
          <TextField label={t('aircraftCount' as Parameters<typeof t>[0])} value={resp.aircraftCount != null ? String(resp.aircraftCount) : ''} onChange={(v) => setRespNum('aircraftCount', v)} disabled={disabled} type="number" />
          <TextField label={t('personnelCount' as Parameters<typeof t>[0])} value={resp.personnelCount != null ? String(resp.personnelCount) : ''} onChange={(v) => setRespNum('personnelCount', v)} disabled={disabled} type="number" />
          <TextField label={t('waterVolumeLiters' as Parameters<typeof t>[0])} value={resp.waterVolumeLiters != null ? String(resp.waterVolumeLiters) : ''} onChange={(v) => setRespNum('waterVolumeLiters', v)} disabled={disabled} type="number" />
          <TextField label={t('retardantVolumeLiters' as Parameters<typeof t>[0])} value={resp.retardantVolumeLiters != null ? String(resp.retardantVolumeLiters) : ''} onChange={(v) => setRespNum('retardantVolumeLiters', v)} disabled={disabled} type="number" />
          <TextField label={t('responseTime' as Parameters<typeof t>[0])} value={resp.responseTimeMinutes != null ? String(resp.responseTimeMinutes) : ''} onChange={(v) => setRespNum('responseTimeMinutes', v)} disabled={disabled} type="number" />
          <TextField label={t('poiLevel' as Parameters<typeof t>[0])} value={resp.poiLevel != null ? String(resp.poiLevel) : ''} onChange={(v) => setRespNum('poiLevel', v)} disabled={disabled} type="number" />
          <TextField label={t('saciComplexity' as Parameters<typeof t>[0])} value={resp.saciComplexity != null ? String(resp.saciComplexity) : ''} onChange={(v) => setRespNum('saciComplexity', v)} disabled={disabled} type="number" />
        </div>
      </div>

      {/* Weather */}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('weatherAtTime' as Parameters<typeof t>[0])}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <TextField label={t('temperatureC' as Parameters<typeof t>[0])} value={weather.temperatureC != null ? String(weather.temperatureC) : ''} onChange={(v) => setWeatherNum('temperatureC', v)} disabled={disabled} type="number" />
          <TextField label={t('humidityPct' as Parameters<typeof t>[0])} value={weather.humidityPct != null ? String(weather.humidityPct) : ''} onChange={(v) => setWeatherNum('humidityPct', v)} disabled={disabled} type="number" />
          <TextField label={t('windSpeedKmh' as Parameters<typeof t>[0])} value={weather.windSpeedKmh != null ? String(weather.windSpeedKmh) : ''} onChange={(v) => setWeatherNum('windSpeedKmh', v)} disabled={disabled} type="number" />
          <TextField label={t('windDirection' as Parameters<typeof t>[0])} value={weather.windDirection ?? ''} onChange={(v) => setWeather((f) => ({ ...f, windDirection: v }))} disabled={disabled} />
          <TextField label={t('daysSinceRain' as Parameters<typeof t>[0])} value={weather.daysSinceRain != null ? String(weather.daysSinceRain) : ''} onChange={(v) => setWeatherNum('daysSinceRain', v)} disabled={disabled} type="number" />
        </div>
      </div>

      {!disabled && (
        <button onClick={handleSave} disabled={saving} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
          {saving ? t('loading') : t('save' as Parameters<typeof t>[0])}
        </button>
      )}
    </div>
  );
}

function toLocalInput(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}
