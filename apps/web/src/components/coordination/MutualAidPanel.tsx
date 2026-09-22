'use client';

import { useEffect, useState } from 'react';
import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { IncidentSelector } from './IncidentSelector';
import { MutualAidForm } from './MutualAidForm';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { MutualAidRequestRecord, MutualAidStatusType } from '@/types/coordination';

const STATUS_TONE: Record<MutualAidStatusType, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  REQUESTED: 'warning',
  APPROVED: 'primary',
  EN_ROUTE: 'neutral',
  ON_SCENE: 'success',
  COMPLETED: 'success',
  DENIED: 'danger',
};

const NEXT_STATUS: Partial<Record<MutualAidStatusType, MutualAidStatusType[]>> = {
  REQUESTED: ['APPROVED', 'DENIED'],
  APPROVED: ['EN_ROUTE'],
  EN_ROUTE: ['ON_SCENE'],
  ON_SCENE: ['COMPLETED'],
};

export function MutualAidPanel() {
  const { t } = useTranslation();
  const selectedIncidentId = useCoordinationStore((s) => s.selectedIncidentId);
  const requests = useCoordinationStore((s) => s.mutualAidRequests);
  const loading = useCoordinationStore((s) => s.mutualAidLoading);
  const fetchMutualAid = useCoordinationStore((s) => s.fetchMutualAid);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchMutualAid(selectedIncidentId ?? undefined);
  }, [selectedIncidentId, fetchMutualAid]);

  async function updateStatus(id: string, status: MutualAidStatusType) {
    await fetchWithAuth(`/api/coordination/mutual-aid/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await fetchMutualAid(selectedIncidentId ?? undefined);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <IncidentSelector
          value={selectedIncidentId ?? ''}
          onChange={(id) => useCoordinationStore.getState().setSelectedIncidentId(id || null)}
        />
        <Button variant="primary" onClick={() => setShowForm(true)}>
          {t('mutualAidRequest')}
        </Button>
      </div>

      {showForm && selectedIncidentId && (
        <MutualAidForm
          incidentId={selectedIncidentId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchMutualAid(selectedIncidentId ?? undefined);
          }}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBox key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('noMutualAidRequests')}</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req: MutualAidRequestRecord) => (
            <div key={req.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge tone={STATUS_TONE[req.status]}>{req.status}</Badge>
                <span className="text-sm font-semibold">{req.requestingProvince} → {req.targetProvince}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(req.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">{t('resourceType')}: </span>
                {req.resourceType}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">{t('justification')}: </span>
                {req.justification}
              </div>
              {req.responseNotes && (
                <div className="text-sm mt-1">
                  <span className="text-muted-foreground">{t('responseNotes')}: </span>
                  {req.responseNotes}
                </div>
              )}
              {NEXT_STATUS[req.status] && (
                <div className="flex gap-2 mt-3">
                  {NEXT_STATUS[req.status]!.map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      variant={nextStatus === 'DENIED' ? 'secondary' : 'primary'}
                      onClick={() => updateStatus(req.id, nextStatus)}
                    >
                      {nextStatus}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
