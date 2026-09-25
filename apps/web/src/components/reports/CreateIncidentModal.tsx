'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { Report, IncidentStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Slider } from '@/components/ui/Slider';

interface CreateIncidentModalProps {
  report: Report | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateIncidentModal({ report, open, onClose, onSuccess }: CreateIncidentModalProps) {
  const { t } = useTranslation();
  const [severity, setSeverity] = useState(3);
  const [status, setStatus] = useState<IncidentStatus>('VIGILANCE');
  const [description, setDescription] = useState(report?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !report) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          latitude: report.latitude,
          longitude: report.longitude,
          cause: report.cause || 'UNKNOWN',
          severity,
          status,
          description: description || report.description
        })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.userMessage || t('errorServer'));
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError(t('connectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-incident-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-surface p-4 sm:p-6 shadow-elev-3 mx-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-incident-title" className="text-xl font-semibold">{t('createIncident')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('closePanel')}
          >
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="mb-2 block text-sm font-medium">
              {t('severity')}
            </span>
            <Slider
              value={severity}
              onValueChange={setSeverity}
              min={1}
              max={5}
              label={t('severity')}
            />
            <div className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {t('severityLevel')}: {severity}/5
            </div>
          </div>

          <div>
            <label htmlFor="incident-status" className="mb-2 block text-sm font-medium">
              {t('initialStatus')}
            </label>
            <select
              id="incident-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus)}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2"
              aria-label={t('initialStatus')}
            >
              <option value="VIGILANCE">{t('statusVigilance')}</option>
              <option value="ALERTE">{t('statusAlerte')}</option>
              <option value="INTERVENTION">{t('statusIntervention')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="incident-description" className="mb-2 block text-sm font-medium">
              {t('description')}
            </label>
            <textarea
              id="incident-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2"
              aria-label={t('description')}
            />
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-danger-muted px-3 py-2 text-sm text-danger-foreground">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={loading} className="flex-1">
              {loading ? t('creating') : t('createIncident')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
