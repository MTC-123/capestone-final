'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { TruckDeployment } from '@/types';

interface Incident {
  id: string;
  status: string;
  description?: string;
}

interface DispatchTruckDialogProps {
  truck: TruckDeployment;
  open: boolean;
  onClose: () => void;
}

export default function DispatchTruckDialog({ truck, open, onClose }: DispatchTruckDialogProps) {
  const { t } = useTranslation();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchWithAuth('/api/geo/incidents')
      .then((res) => res.json())
      .then((data) => {
        const features = data?.features ?? [];
        const active = features
          .filter((f: { properties: { status: string } }) => f.properties.status !== 'ETEINT')
          .map((f: { properties: { id: string; status: string; description?: string } }) => ({
            id: f.properties.id,
            status: f.properties.status,
            description: f.properties.description,
          }));
        setIncidents(active);
      })
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-elev-2">
          <h3 className="text-lg font-bold mb-1">{t('dispatchToIncident')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{truck.truckName}</p>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : incidents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('noVehiclesAvailable')}</div>
          ) : (
            <div className="max-h-60 overflow-auto space-y-2 mb-4">
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                    selectedIncidentId === inc.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-semibold">#{inc.id.slice(0, 6)}</div>
                  <div className="text-xs text-muted-foreground">{inc.status}{inc.description ? ` — ${inc.description}` : ''}</div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={!selectedIncidentId}
              onClick={onClose}
              className="flex-1"
            >
              {t('dispatchConfirm')}
            </Button>
            <Button variant="secondary" onClick={onClose} className="flex-1">
              {t('cancel')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
