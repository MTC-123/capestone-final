'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { ALERT_SOURCES, RECORD_STATUSES } from '@/lib/fire-records/validation';

export function FireRecordFilters() {
  const { t } = useTranslation();
  const { filters, setFilters, clearFilters, fetchRecords } = useFireRecordStore();

  const handleApply = () => {
    fetchRecords(false);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4" data-testid="fire-record-filters">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{t('fireRecordStatus')}</label>
        <select
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
          value={filters.status || ''}
          onChange={(e) => setFilters({ status: (e.target.value || null) as typeof filters.status })}
        >
          <option value="">{t('allStatuses' as Parameters<typeof t>[0])}</option>
          {RECORD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{t('fireRecordAlertSource')}</label>
        <select
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
          value={filters.alertSource || ''}
          onChange={(e) => setFilters({ alertSource: (e.target.value || null) as typeof filters.alertSource })}
        >
          <option value="">{t('allTypes' as Parameters<typeof t>[0])}</option>
          {ALERT_SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{t('search')}</label>
        <input
          type="text"
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
          placeholder={t('search')}
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleApply}
          className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
        >
          {t('search')}
        </button>
        <button
          onClick={() => { clearFilters(); fetchRecords(false); }}
          className="rounded border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
