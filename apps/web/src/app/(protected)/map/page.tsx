'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import type { WeatherData, IncidentStatus } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { RightDrawer } from '@/components/shell/RightDrawer';
import type { TranslationKey } from '@/i18n/translations';

import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useDispatchStore } from '@/store/useDispatchStore';
import { DispatchPanel } from '@/components/dispatch/DispatchPanel';
import { IncidentFireRecordPanel } from '@/components/fire-records/IncidentFireRecordPanel';
import { computeSACILevel } from '@/lib/map/complexity';
import { computePOILevel } from '@/lib/map/poiLevel';

const MapStatusBar = dynamic(() => import('@/components/map/MapStatusBar'), { ssr: false });

function MapDataErrorBanner() {
  const { t } = useTranslation();
  const dataErrors = useMapStore((s) => s.dataErrors);
  const clearAllErrors = useMapStore((s) => s.clearAllErrors);
  const hasErrors = Object.values(dataErrors).some(err => err !== null);

  if (!hasErrors) return null;

  const handleRetry = () => {
    clearAllErrors();
    window.location.reload();
  };

  return (
    <div role="alert" className="absolute left-3 right-3 top-16 z-20 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning shadow-xl backdrop-blur-md sm:left-1/2 sm:right-auto sm:top-3 sm:max-w-md sm:-translate-x-1/2 sm:px-4 sm:py-3 sm:text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-semibold">{t('mapDataWarning')}</div>
          <div className="mt-1 text-xs space-y-1">
            {dataErrors.incidents && <div>• Incidents: {dataErrors.incidents}</div>}
            {dataErrors.resources && <div>• Resources: {dataErrors.resources}</div>}
            {dataErrors.infrastructure && <div>• Infrastructure: {dataErrors.infrastructure}</div>}
            {dataErrors.firmsDetections && <div>• FIRMS Detections: {dataErrors.firmsDetections}</div>}
            {dataErrors.effisDetections && <div>• EFFIS Detections: {dataErrors.effisDetections}</div>}
            {dataErrors.wind && <div>• Wind: {dataErrors.wind}</div>}
          </div>
        </div>
        <button
          onClick={handleRetry}
          className="text-xs font-medium hover:underline whitespace-nowrap"
          aria-label={t('retry')}
        >
          {t('retry')}
        </button>
      </div>
    </div>
  );
}

function RicerMapLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center bg-surface-2 text-sm text-muted-foreground">
      {t('loadingMap')}
    </div>
  );
}

const RicerMap = dynamic(() => import('@/components/map/RicerMap'), {
  ssr: false,
  loading: () => <RicerMapLoading />,
});

const INCIDENT_STATUS_KEYS: Record<IncidentStatus, TranslationKey> = {
  VIGILANCE: 'statusVigilance',
  ALERTE: 'statusAlerte',
  INTERVENTION: 'statusIntervention',
  MAITRISE: 'statusMaitrise',
  ETEINT: 'statusEteint',
};

const INCIDENT_STATUS_TONES: Record<IncidentStatus, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  VIGILANCE: 'warning',
  ALERTE: 'danger',
  INTERVENTION: 'danger',
  MAITRISE: 'primary',
  ETEINT: 'neutral',
};

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const selectedIncidentId = useMapStore((s) => s.selectedIncidentId);
  const setSelectedIncidentId = useMapStore((s) => s.setSelectedIncidentId);
  const incidents = useMapStore((s) => s.incidents);
  const setStoreWeather = useMapStore((s) => s.setWeather);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (selectedIncidentId) setDrawerOpen(true);
  }, [selectedIncidentId]);

  useEffect(() => {
    const selectedFromUrl = searchParams.get('selected');
    if (!selectedFromUrl || selectedIncidentId === selectedFromUrl) return;
    const exists = incidents.features.some((feature) => feature.properties.id === selectedFromUrl);
    if (!exists) return;
    setSelectedIncidentId(selectedFromUrl);
    setDrawerOpen(true);
  }, [incidents.features, searchParams, selectedIncidentId, setSelectedIncidentId]);

  const fetchWeather = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/weather');
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setWeather(null);
        return;
      }
      const w = data as WeatherData;
      setWeather(w);
      setStoreWeather(w);
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  }, [setStoreWeather]);

  useEffect(() => {
    if (incidents.features.length > 0) {
      setLastUpdated(Date.now());
    }
  }, [incidents]);

  const handleUpdateIncident = async (field: 'status' | 'severity' | 'description', value: IncidentStatus | number | string) => {
    if (!selectedIncidentId) return;

    setUpdateError(null);
    try {
      const response = await fetchWithAuth(`/api/incidents/${selectedIncidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });

      if (!response.ok) {
        const data = await response.json();
        setUpdateError(data.error?.userMessage || t('errorServer'));
        return;
      }

      try {
        const refreshRes = await fetchWithAuth('/api/geo/incidents');
        if (refreshRes.ok) {
          const refreshed = await refreshRes.json();
          useMapStore.getState().setIncidents(refreshed);
          useMapStore.getState().setLastSuccessfulSync(new Date());
        }
      } catch {
        // Non-critical
      }
    } catch {
      setUpdateError(t('connectionError'));
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  const selectedIncident = useMemo(
    () => (selectedIncidentId ? incidents.features.find((f) => f.properties.id === selectedIncidentId) : undefined),
    [incidents, selectedIncidentId]
  );

  const activeIncidents = useMemo(
    () => incidents.features.filter((f) => f.properties.status !== 'ETEINT').length,
    [incidents]
  );

  const {
    setIsPanelOpen,
    setSelectedIncidentId: setDispatchIncidentId,
    selectedIncidentId: dispatchIncidentId
  } = useDispatchStore();

  const handleDispatchReinforcements = useCallback(() => {
    if (!selectedIncident) return;
    setDispatchIncidentId(selectedIncident.properties.id);
    setIsPanelOpen(true);
  }, [selectedIncident, setDispatchIncidentId, setIsPanelOpen]);

  const handleShare = useCallback(async () => {
    if (!selectedIncident) return;
    const shareData = {
      title: `${t('fireIncident')} #${selectedIncident.properties.id.slice(0, 6)}`,
      text: selectedIncident.properties.description ?? '',
      url: `${window.location.origin}/map?selected=${selectedIncident.properties.id}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus(t('shared'));
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setShareStatus(t('linkCopied'));
      }
      setTimeout(() => setShareStatus(null), 3000);
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [selectedIncident, t]);

  const getStatusLabel = (status: IncidentStatus) => t(INCIDENT_STATUS_KEYS[status]);
  const getStatusTone = (status: IncidentStatus) => INCIDENT_STATUS_TONES[status];

  const getCauseLabel = (causeKey: string | undefined) => {
    if (!causeKey) return t('unknown');
    const causeMap: Record<string, TranslationKey> = {
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
    return t(causeMap[causeKey] ?? 'unknown');
  };

  const coords = selectedIncident?.geometry?.coordinates as [number, number] | undefined;

  // SACI + POI for selected incident
  const saci = selectedIncident
    ? computeSACILevel(selectedIncident.properties.severity, selectedIncident.properties.status, 0)
    : null;
  const poi = selectedIncident
    ? computePOILevel(selectedIncident.properties.severity, selectedIncident.properties.status)
    : null;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <h1 className="sr-only">{t('fireMap')}</h1>

      {/* Map fills entire viewport */}
      <RicerMap weather={weather} weatherLoading={weatherLoading} />

      {/* Floating overlays */}
      <MapStatusBar weather={weather} activeIncidents={activeIncidents} lastUpdated={lastUpdated} />
      <MapDataErrorBanner />

      {/* Incident detail drawer — only when selected */}
      {selectedIncidentId && (
        <RightDrawer
          title={t('incidentDetails')}
          open={drawerOpen}
          onOpenChange={(open) => {
            setDrawerOpen(open);
            if (!open) setSelectedIncidentId(null);
          }}
        >
          <div className="space-y-5 p-4">
            {!selectedIncident ? (
              <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
                {t('selectIncident')}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      #{selectedIncident.properties.id.slice(0, 6)}
                    </div>
                    <div className="mt-1 text-lg font-extrabold tracking-tight">
                      {getStatusLabel(selectedIncident.properties.status)}
                    </div>
                    {coords && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        {coords[1].toFixed(4)}, {coords[0].toFixed(4)}
                      </div>
                    )}
                  </div>
                  <Badge tone={getStatusTone(selectedIncident.properties.status)}>
                    {getStatusLabel(selectedIncident.properties.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t('cause')}
                    </div>
                    <div className="mt-2 text-sm font-semibold">{getCauseLabel(selectedIncident.properties.cause)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t('severity')}
                    </div>
                    <div className="mt-2 text-sm font-semibold">{selectedIncident.properties.severity}/5</div>
                  </div>
                </div>

                {/* SACI + POI indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {saci && (
                    <div className="rounded-lg border border-border bg-surface-2 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t('saciLevel' as TranslationKey)}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: saci.color }}
                        >
                          {saci.level}
                        </span>
                        <span className="text-sm font-semibold">{t(saci.labelKey as TranslationKey)}</span>
                      </div>
                    </div>
                  )}
                  {poi && (
                    <div className="rounded-lg border border-border bg-surface-2 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t('poiLevel' as TranslationKey)}
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        POI {poi.level} — {t(poi.labelKey as TranslationKey)}
                      </div>
                    </div>
                  )}
                </div>

                {selectedIncident.properties.description ? (
                  <div className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t('description')}
                    </div>
                    <div className="mt-2 text-sm">{selectedIncident.properties.description}</div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Button variant="primary" onClick={handleDispatchReinforcements}>
                    <Icon name="campaign" aria-hidden={true} size={20} />
                    {t('dispatchReinforcements')}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={handleShare}>
                      <Icon name="share" aria-hidden={true} size={20} />
                      {shareStatus || t('share')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => router.push(`/reports-list`)}
                    >
                      <Icon name="open" aria-hidden={true} size={20} />
                      {t('openReport')}
                    </Button>
                  </div>
                </div>

                {user?.role === 'OFFICIAL' && (
                  <div className="space-y-4 border-t border-border pt-4">
                    <h3 className="font-semibold">{t('manageIncident')}</h3>

                    <div>
                      <label className="mb-2 block text-sm font-medium">{t('updateStatus')}</label>
                      <div className="flex flex-wrap gap-2">
                        {(['VIGILANCE', 'ALERTE', 'INTERVENTION', 'MAITRISE', 'ETEINT'] as IncidentStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleUpdateIncident('status', s)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                              selectedIncident.properties.status === s
                                ? 'bg-primary text-white'
                                : 'bg-surface-2 text-foreground hover:bg-surface-3'
                            }`}
                          >
                            {t(INCIDENT_STATUS_KEYS[s])}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">{t('severity')}</label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={selectedIncident.properties.severity}
                        onChange={(e) => handleUpdateIncident('severity', parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="mt-1 text-sm text-muted-foreground">
                        {selectedIncident.properties.severity}/5
                      </div>
                    </div>

                    {updateError && (
                      <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                        {updateError}
                      </div>
                    )}
                  </div>
                )}

                {selectedIncident && (
                  <IncidentFireRecordPanel incidentId={selectedIncident.properties.id} />
                )}
              </>
            )}
          </div>
        </RightDrawer>
      )}

      {/* Dispatch Panel */}
      <DispatchPanel
        incidentId={dispatchIncidentId}
        onClose={() => {
          setIsPanelOpen(false);
          setDispatchIncidentId(null);
        }}
      />
    </div>
  );
}
