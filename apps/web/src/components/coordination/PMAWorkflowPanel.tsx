'use client';

import { useEffect, useState } from 'react';
import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { IncidentSelector } from './IncidentSelector';
import { PMAInitiateForm } from './PMAInitiateForm';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { PMA_STEP_ORDER, getStepIndex, getStepLabelKey } from '@/lib/coordination/pmaSteps';
import type { PMAWorkflowRecord, PMAStepEntry } from '@/types/coordination';
import type { TranslationKey } from '@/i18n/translations';

export function PMAWorkflowPanel() {
  const { t } = useTranslation();
  const selectedIncidentId = useCoordinationStore((s) => s.selectedIncidentId);
  const workflows = useCoordinationStore((s) => s.pmaWorkflows);
  const loading = useCoordinationStore((s) => s.pmaLoading);
  const fetchPMA = useCoordinationStore((s) => s.fetchPMAWorkflows);
  const [showInitiate, setShowInitiate] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    fetchPMA(selectedIncidentId ?? undefined);
  }, [selectedIncidentId, fetchPMA]);

  async function advanceStep(workflowId: string) {
    setAdvancing(true);
    try {
      const res = await fetchWithAuth(`/api/coordination/pma/${workflowId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) await fetchPMA(selectedIncidentId ?? undefined);
    } finally {
      setAdvancing(false);
    }
  }

  async function cancelWorkflow(workflowId: string) {
    const res = await fetchWithAuth(`/api/coordination/pma/${workflowId}/cancel`, {
      method: 'POST',
    });
    if (res.ok) await fetchPMA(selectedIncidentId ?? undefined);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <IncidentSelector
          value={selectedIncidentId ?? ''}
          onChange={(id) => useCoordinationStore.getState().setSelectedIncidentId(id || null)}
        />
        {selectedIncidentId && (
          <Button variant="primary" onClick={() => setShowInitiate(true)}>
            {t('pmaInitiate')}
          </Button>
        )}
      </div>

      {showInitiate && selectedIncidentId && (
        <PMAInitiateForm
          incidentId={selectedIncidentId}
          onClose={() => setShowInitiate(false)}
          onSaved={() => {
            setShowInitiate(false);
            fetchPMA(selectedIncidentId ?? undefined);
          }}
        />
      )}

      {loading ? (
        <SkeletonBox className="h-64 rounded-lg" />
      ) : workflows.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('noPMAWorkflows')}</p>
      ) : (
        <div className="space-y-6">
          {workflows.map((wf: PMAWorkflowRecord) => {
            const currentIdx = getStepIndex(wf.currentStep);
            return (
              <div key={wf.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge tone={wf.status === 'IN_PROGRESS' ? 'warning' : wf.status === 'COMPLETED' ? 'success' : 'danger'}>
                    {wf.status}
                  </Badge>
                  {wf.aircraftType && (
                    <span className="text-sm">
                      {wf.aircraftType} × {wf.aircraftCount ?? 1}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(wf.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2">
                  {PMA_STEP_ORDER.map((step, idx) => {
                    const stepEntry = wf.steps.find((s: PMAStepEntry) => s.step === step);
                    const isComplete = idx < currentIdx || (idx === currentIdx && wf.status === 'COMPLETED');
                    const isCurrent = idx === currentIdx && wf.status === 'IN_PROGRESS';
                    const isPending = idx > currentIdx;

                    return (
                      <div key={step} className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isComplete
                            ? 'bg-success text-success-foreground'
                            : isCurrent
                              ? 'bg-primary text-primary-foreground animate-pulse'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {isComplete ? '✓' : idx + 1}
                        </div>
                        <div className="flex-1">
                          <span className={`text-sm font-semibold ${isPending ? 'text-muted-foreground' : ''}`}>
                            {t(getStepLabelKey(step) as TranslationKey)}
                          </span>
                          {stepEntry && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {new Date(stepEntry.timestamp).toLocaleString()}
                              {stepEntry.actor && ` — ${stepEntry.actor}`}
                            </span>
                          )}
                        </div>
                        {isCurrent && (
                          <Button
                            variant="primary"
                            onClick={() => advanceStep(wf.id)}
                            disabled={advancing}
                          >
                            {t('advance')}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {wf.status === 'IN_PROGRESS' && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <Button variant="secondary" onClick={() => cancelWorkflow(wf.id)}>
                      {t('cancelWorkflow')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
