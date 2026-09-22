'use client';

import { useEffect, useState } from 'react';
import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { IncidentSelector } from './IncidentSelector';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { POIActivationLevel, POIActivationRecord } from '@/types/coordination';
import type { TranslationKey } from '@/i18n/translations';

const POI_LEVELS: { level: POIActivationLevel; labelKey: TranslationKey; tone: 'warning' | 'danger' | 'danger' }[] = [
  { level: 'POI_1', labelKey: 'poiLevel1', tone: 'warning' },
  { level: 'POI_2', labelKey: 'poiLevel2', tone: 'danger' },
  { level: 'POI_3', labelKey: 'poiLevel3', tone: 'danger' },
];

export function POIActivationPanel() {
  const { t } = useTranslation();
  const selectedIncidentId = useCoordinationStore((s) => s.selectedIncidentId);
  const poiActivations = useCoordinationStore((s) => s.poiActivations);
  const loading = useCoordinationStore((s) => s.poiLoading);
  const fetchPOI = useCoordinationStore((s) => s.fetchPOIActivations);
  const fetchCommLog = useCoordinationStore((s) => s.fetchCommLog);
  const [activating, setActivating] = useState(false);
  const [confirmPOI3, setConfirmPOI3] = useState(false);

  useEffect(() => {
    if (selectedIncidentId) fetchPOI(selectedIncidentId);
  }, [selectedIncidentId, fetchPOI]);

  const activeActivation = poiActivations.find((a: POIActivationRecord) => !a.deactivatedAt);

  async function activatePOI(level: POIActivationLevel) {
    if (!selectedIncidentId) return;
    if (level === 'POI_3' && !confirmPOI3) {
      setConfirmPOI3(true);
      return;
    }
    setActivating(true);
    setConfirmPOI3(false);
    try {
      const res = await fetchWithAuth('/api/coordination/poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId: selectedIncidentId, level }),
      });
      if (res.ok) {
        await fetchPOI(selectedIncidentId);
        await fetchCommLog(true);
      }
    } finally {
      setActivating(false);
    }
  }

  async function deactivatePOI() {
    if (!activeActivation) return;
    setActivating(true);
    try {
      const res = await fetchWithAuth(`/api/coordination/poi/${activeActivation.id}/deactivate`, {
        method: 'POST',
      });
      if (res.ok && selectedIncidentId) {
        await fetchPOI(selectedIncidentId);
        await fetchCommLog(true);
      }
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-4">
      <IncidentSelector
        value={selectedIncidentId ?? ''}
        onChange={(id) => useCoordinationStore.getState().setSelectedIncidentId(id || null)}
      />

      {!selectedIncidentId ? (
        <p className="text-center text-muted-foreground py-8">{t('selectIncidentFirst')}</p>
      ) : loading ? (
        <SkeletonBox className="h-32 rounded-lg" />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          {activeActivation && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{t('currentPOILevel')}</span>
              <Badge tone="danger">{activeActivation.level.replace('_', ' ')}</Badge>
              <Button variant="secondary" onClick={deactivatePOI} disabled={activating}>
                {t('deactivatePOI')}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {POI_LEVELS.map(({ level, labelKey }) => (
              <Button
                key={level}
                variant={activeActivation?.level === level ? 'primary' : 'secondary'}
                onClick={() => activatePOI(level)}
                disabled={activating || activeActivation?.level === level}
              >
                {t('activatePOI')} {t(labelKey)}
              </Button>
            ))}
          </div>

          {confirmPOI3 && (
            <div className="rounded-md bg-danger/10 border border-danger/30 p-3">
              <p className="text-sm text-danger font-semibold mb-2">{t('confirmPOI3')}</p>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => activatePOI('POI_3')}>
                  {t('confirm')}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmPOI3(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          )}

          {poiActivations.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">{t('poiHistory')}</h4>
              <div className="space-y-2">
                {poiActivations.map((a: POIActivationRecord) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <Badge tone={a.deactivatedAt ? 'neutral' : 'danger'}>{a.level.replace('_', ' ')}</Badge>
                    <span>{new Date(a.activatedAt).toLocaleString()}</span>
                    {a.deactivatedAt && (
                      <span className="text-muted-foreground">
                        → {new Date(a.deactivatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
