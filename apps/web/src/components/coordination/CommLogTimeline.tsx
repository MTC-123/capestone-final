'use client';

import { useEffect } from 'react';
import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { CommLogForm } from './CommLogForm';
import { IncidentSelector } from './IncidentSelector';
import type { CommLogEntry, CommLogCategory } from '@/types/coordination';
import type { TranslationKey } from '@/i18n/translations';

const CATEGORY_TONE: Record<CommLogCategory, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  ALERT_SENT: 'danger',
  ORDER_GIVEN: 'primary',
  STATUS_UPDATE: 'neutral',
  RESOURCE_REQUEST: 'warning',
  ESCALATION: 'danger',
  DE_ESCALATION: 'success',
  AVIATION_REQUEST: 'warning',
  MUTUAL_AID: 'primary',
  GENERAL: 'neutral',
};

const CATEGORY_LABEL_MAP: Record<CommLogCategory, TranslationKey> = {
  ALERT_SENT: 'catAlertSent',
  ORDER_GIVEN: 'catOrderGiven',
  STATUS_UPDATE: 'catStatusUpdate',
  RESOURCE_REQUEST: 'catResourceRequest',
  ESCALATION: 'catEscalation',
  DE_ESCALATION: 'catDeEscalation',
  AVIATION_REQUEST: 'catAviationRequest',
  MUTUAL_AID: 'catMutualAid',
  GENERAL: 'catGeneral',
};

export function CommLogTimeline() {
  const { t } = useTranslation();
  const commLog = useCoordinationStore((s) => s.commLog);
  const loading = useCoordinationStore((s) => s.commLogLoading);
  const hasMore = useCoordinationStore((s) => s.commLogHasMore);
  const fetchCommLog = useCoordinationStore((s) => s.fetchCommLog);
  const filter = useCoordinationStore((s) => s.commLogFilter);
  const setFilter = useCoordinationStore((s) => s.setCommLogFilter);

  useEffect(() => {
    fetchCommLog(true);
  }, [fetchCommLog, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <IncidentSelector
          value={filter.incidentId ?? ''}
          onChange={(id) => setFilter({ ...filter, incidentId: id || undefined })}
        />
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('filterByCategory')}</label>
          <select
            value={filter.category ?? ''}
            onChange={(e) => setFilter({ ...filter, category: (e.target.value || undefined) as CommLogCategory | undefined })}
            className="mt-1 block w-full sm:w-auto rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">{t('all')}</option>
            {Object.keys(CATEGORY_LABEL_MAP).map((cat) => (
              <option key={cat} value={cat}>{t(CATEGORY_LABEL_MAP[cat as CommLogCategory])}</option>
            ))}
          </select>
        </div>
      </div>

      <CommLogForm />

      {loading && commLog.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBox key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : commLog.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('commLogEmpty')}</p>
      ) : (
        <div className="relative border-l-2 border-border pl-4 sm:pl-6 space-y-4">
          {commLog.map((entry: CommLogEntry) => (
            <div key={entry.id} className="relative">
              <div className="absolute -left-[23px] sm:-left-[31px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-surface" />
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge tone={CATEGORY_TONE[entry.category]}>
                    {t(CATEGORY_LABEL_MAP[entry.category])}
                  </Badge>
                  {entry.fromAgency && (
                    <span className="text-xs text-muted-foreground">{entry.fromAgency}</span>
                  )}
                  {entry.toAgency && (
                    <span className="text-xs text-muted-foreground">→ {entry.toAgency}</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{entry.message}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {entry.authorCin}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && commLog.length > 0 && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => fetchCommLog()} disabled={loading}>
            {loading ? t('loading') : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
