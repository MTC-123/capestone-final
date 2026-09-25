'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { ALERT_SOURCES, RECORD_STATUSES } from '@/lib/fire-records/validation';
import { Button } from '@/components/ui/Button';

export function FireRecordFilters() {
  const { t } = useTranslation();
  const { filters, setFilters, clearFilters, fetchRecords } = useFireRecordStore();

  const handleApply = () => {
    fetchRecords(false);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4" data-testid="fire-record-filters">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{t('fireRecordStatus')}</label>
        <select
          className="rounded-[10px] border border-border bg-surface px-2 py-1.5 text-sm"
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
          className="rounded-[10px] border border-border bg-surface px-2 py-1.5 text-sm"
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
          className="rounded-[10px] border border-border bg-surface px-2 py-1.5 text-sm"
          placeholder={t('search')}
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={handleApply}>
          {t('search')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => { clearFilters(); fetchRecords(false); }}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
