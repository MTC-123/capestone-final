'use client';

import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
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
      {agencies.map((agency: AgencyStatusRecord) => {
        const total = agency.unitsAvailable + agency.unitsDeployed;
        const deployedPct = total ? Math.round((agency.unitsDeployed / total) * 100) : 0;
        return (
          <article key={agency.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-elev-1">
            <header className="flex items-start justify-between gap-3">
              <h3 className="text-[15px] font-semibold leading-snug">{t(AGENCY_LABEL_MAP[agency.agency])}</h3>
              <Badge tone={statusTone(agency.status)} className="shrink-0">
                {t(statusLabelKey(agency.status))}
              </Badge>
            </header>

            <dl className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{t('unitsAvailable')}</dt>
                <dd className="mt-0.5 font-mono text-xl font-medium tabular">{agency.unitsAvailable}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{t('unitsDeployed')}</dt>
                <dd className="mt-0.5 font-mono text-xl font-medium tabular">{agency.unitsDeployed}</dd>
              </div>
            </dl>
            {total > 0 && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-accent-fire" style={{ width: `${deployedPct}%` }} />
              </div>
            )}

            {(agency.aviationStatus || agency.reserveStatus) && (
              <dl className="mt-4 space-y-3 text-[13px]">
                {agency.aviationStatus && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">{t('aviationStatus')}</dt>
                    <dd className="mt-0.5 leading-relaxed text-foreground">
                      <bdi>{agency.aviationStatus}</bdi>
                    </dd>
                  </div>
                )}
                {agency.reserveStatus && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">{t('reserveStatus')}</dt>
                    <dd className="mt-0.5 leading-relaxed text-foreground">
                      <bdi>{agency.reserveStatus}</bdi>
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {agency.contactName && (
              <div className="mt-4 border-t border-border pt-3 text-[13px]">
                <p className="text-xs font-medium text-muted-foreground">{t('contactInfo')}</p>
                <p className="mt-0.5">
                  <bdi>{agency.contactName}</bdi>
                </p>
                {agency.contactPhone && (
                  <a href={`tel:${agency.contactPhone}`} className="font-mono text-xs text-primary hover:underline">
                    <bdi>{agency.contactPhone}</bdi>
                  </a>
                )}
              </div>
            )}

            <div className="mt-auto pt-4">
              {editingAgency === agency.agency ? (
                <AgencyEditForm agency={agency} onClose={() => setEditingAgency(null)} />
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setEditingAgency(agency.agency)}>
                  <Icon name="pencil" size={14} />
                  {t('edit')}
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
