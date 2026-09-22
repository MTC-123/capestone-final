'use client';

import { useEffect, useState } from 'react';
import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { IncidentSelector } from './IncidentSelector';
import { ICSAssignForm } from './ICSAssignForm';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { ICSRoleType, ICSAssignmentRecord } from '@/types/coordination';
import type { TranslationKey } from '@/i18n/translations';

const ICS_HIERARCHY: { role: ICSRoleType; labelKey: TranslationKey; tier: number }[] = [
  { role: 'INCIDENT_COMMANDER', labelKey: 'icsIncidentCommander', tier: 0 },
  { role: 'OPERATIONS_CHIEF', labelKey: 'icsOperationsChief', tier: 1 },
  { role: 'LOGISTICS_CHIEF', labelKey: 'icsLogisticsChief', tier: 1 },
  { role: 'PLANNING_CHIEF', labelKey: 'icsPlanningChief', tier: 1 },
  { role: 'COMMUNICATIONS_OFFICER', labelKey: 'icsCommunicationsOfficer', tier: 2 },
  { role: 'SAFETY_OFFICER', labelKey: 'icsSafetyOfficer', tier: 2 },
  { role: 'LIAISON_OFFICER', labelKey: 'icsLiaisonOfficer', tier: 2 },
];

export function ICSChart() {
  const { t } = useTranslation();
  const selectedIncidentId = useCoordinationStore((s) => s.selectedIncidentId);
  const assignments = useCoordinationStore((s) => s.icsAssignments);
  const loading = useCoordinationStore((s) => s.icsLoading);
  const fetchICS = useCoordinationStore((s) => s.fetchICSAssignments);
  const [assigningRole, setAssigningRole] = useState<ICSRoleType | null>(null);

  useEffect(() => {
    if (selectedIncidentId) fetchICS(selectedIncidentId);
  }, [selectedIncidentId, fetchICS]);

  function getAssignment(role: ICSRoleType): ICSAssignmentRecord | undefined {
    return assignments.find((a) => a.role === role && !a.relievedAt);
  }

  async function relieveRole(assignmentId: string) {
    const res = await fetchWithAuth(`/api/coordination/ics/${assignmentId}/relieve`, {
      method: 'POST',
    });
    if (res.ok && selectedIncidentId) {
      await fetchICS(selectedIncidentId);
    }
  }

  if (!selectedIncidentId) {
    return (
      <div className="space-y-4">
        <IncidentSelector
          value=""
          onChange={(id) => useCoordinationStore.getState().setSelectedIncidentId(id || null)}
        />
        <p className="text-center text-muted-foreground py-8">{t('selectIncidentFirst')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <IncidentSelector
        value={selectedIncidentId}
        onChange={(id) => useCoordinationStore.getState().setSelectedIncidentId(id || null)}
      />

      {loading ? (
        <SkeletonBox className="h-64 rounded-lg" />
      ) : (
        <div className="space-y-6">
          {[0, 1, 2].map((tier) => (
            <div
              key={tier}
              className={`flex flex-wrap justify-center gap-4 ${tier === 0 ? '' : 'pl-8'}`}
            >
              {ICS_HIERARCHY.filter((h) => h.tier === tier).map(({ role, labelKey }) => {
                const assignment = getAssignment(role);
                return (
                  <div
                    key={role}
                    className="w-64 rounded-lg border border-border bg-surface p-4 text-center"
                  >
                    <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">
                      {t(labelKey)}
                    </h4>
                    {assignment ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">{assignment.assigneeName}</div>
                        {assignment.assigneeAgency && (
                          <Badge tone="primary">{assignment.assigneeAgency}</Badge>
                        )}
                        {assignment.assigneePhone && (
                          <div className="text-xs text-muted-foreground">{assignment.assigneePhone}</div>
                        )}
                        <div className="flex gap-1 justify-center mt-2">
                          <Button
                            variant="secondary"
                            onClick={() => setAssigningRole(role)}
                          >
                            {t('reassign')}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => relieveRole(assignment.id)}
                          >
                            {t('relieve')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => setAssigningRole(role)}
                      >
                        {t('assign')}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {assigningRole && selectedIncidentId && (
        <ICSAssignForm
          incidentId={selectedIncidentId}
          role={assigningRole}
          onClose={() => setAssigningRole(null)}
          onSaved={() => {
            setAssigningRole(null);
            if (selectedIncidentId) fetchICS(selectedIncidentId);
          }}
        />
      )}
    </div>
  );
}
