'use client';

import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { AgencyEditForm } from './AgencyEditForm';
import { useState } from 'react';
import type { AgencyStatusRecord, MoroccanAgency } from '@/types/coordination';
import type { TranslationKey } from '@/i18n/translations';

const AGENCY_LABEL_MAP: Record<MoroccanAgency, TranslationKey> = {
  DEF: 'agencyDEF',
  PROTECTION_CIVILE: 'agencyProtectionCivile',
  GENDARMERIE_ROYALE: 'agencyGendarmerieRoyale',
  FORCES_AUXILIAIRES: 'agencyForcesAuxiliaires',
  FORCES_ROYALES_AIR: 'agencyFRA',
  FAR: 'agencyFAR',
  AUTORITES_LOCALES: 'agencyAutoritesLocales',
};

function statusTone(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'ONLINE') return 'success';
  if (status === 'STANDBY') return 'warning';
  return 'danger';
}

function statusLabelKey(status: string): TranslationKey {
  if (status === 'ONLINE') return 'agencyOnline';
  if (status === 'STANDBY') return 'agencyStandby';
  return 'agencyOffline';
}

export function AgencyStatusBoard() {
  const { t } = useTranslation();
  const agencies = useCoordinationStore((s) => s.agencies);
  const loading = useCoordinationStore((s) => s.agenciesLoading);
  const [editingAgency, setEditingAgency] = useState<MoroccanAgency | null>(null);

  if (loading && agencies.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBox key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {agencies.map((agency: AgencyStatusRecord) => (
        <div
          key={agency.id}
          className="rounded-lg border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold truncate">
              {t(AGENCY_LABEL_MAP[agency.agency])}
            </h3>
            <Badge tone={statusTone(agency.status)}>
              {t(statusLabelKey(agency.status))}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('unitsAvailable')}</span>
              <span className="font-semibold">{agency.unitsAvailable}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('unitsDeployed')}</span>
              <span className="font-semibold">{agency.unitsDeployed}</span>
            </div>
            {agency.aviationStatus && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('aviationStatus')}</span>
                <span className="font-semibold">{agency.aviationStatus}</span>
              </div>
            )}
            {agency.reserveStatus && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('reserveStatus')}</span>
                <span className="font-semibold">{agency.reserveStatus}</span>
              </div>
            )}
            {agency.contactName && (
              <div className="pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">{t('contactInfo')}</span>
                <div className="text-xs">{agency.contactName}</div>
                {agency.contactPhone && <div className="text-xs">{agency.contactPhone}</div>}
              </div>
            )}
          </div>

          {editingAgency === agency.agency ? (
            <AgencyEditForm
              agency={agency}
              onClose={() => setEditingAgency(null)}
            />
          ) : (
            <button
              onClick={() => setEditingAgency(agency.agency)}
              className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              {t('edit')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
