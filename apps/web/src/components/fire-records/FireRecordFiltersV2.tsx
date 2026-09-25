'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { ALERT_SOURCES, RECORD_STATUSES, CAUSE_CATEGORIES } from '@/lib/fire-records/validation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { ViewMode } from '@/store/useFireRecordStore';

export function FireRecordFiltersV2() {
  const { t } = useTranslation();
  const { filters, setFilters, clearFilters, fetchRecords, viewMode, setViewMode } = useFireRecordStore();

  const handleApply = () => {
    fetchRecords(false);
  };

  return (
    <div className="space-y-3" data-testid="fire-record-filters-v2">
      <div className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
        {/* Status */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('fireRecordStatus')}</span>
          <select
            className="min-h-11 rounded-[10px] border border-border bg-surface px-2 py-2 text-sm"
            value={filters.status || ''}
            onChange={(e) => setFilters({ status: (e.target.value || null) as typeof filters.status })}
          >
            <option value="">{t('allStatuses' as Parameters<typeof t>[0])}</option>
            {RECORD_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`fireRecord${s.charAt(0)}${s.slice(1).toLowerCase()}` as Parameters<typeof t>[0])}</option>
            ))}
          </select>
        </label>

        {/* Cause */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('fireRecordCause' as Parameters<typeof t>[0])}</span>
          <select
            className="min-h-11 rounded-[10px] border border-border bg-surface px-2 py-2 text-sm"
            value={filters.cause || ''}
            onChange={(e) => setFilters({ cause: (e.target.value || null) as typeof filters.cause })}
          >
            <option value="">{t('allTypes' as Parameters<typeof t>[0])}</option>
            {CAUSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`cause${c}` as Parameters<typeof t>[0])}</option>
            ))}
          </select>
        </label>

        {/* Alert Source */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('fireRecordAlertSource')}</span>
          <select
            className="min-h-11 rounded-[10px] border border-border bg-surface px-2 py-2 text-sm"
            value={filters.alertSource || ''}
            onChange={(e) => setFilters({ alertSource: (e.target.value || null) as typeof filters.alertSource })}
          >
            <option value="">{t('allTypes' as Parameters<typeof t>[0])}</option>
            {ALERT_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Date range */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('dateFrom' as Parameters<typeof t>[0])}</span>
          <input
            type="date"
            className="min-h-11 rounded-[10px] border border-border bg-surface px-2 py-2 text-sm"
            value={filters.dateFrom || ''}
            onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('dateTo' as Parameters<typeof t>[0])}</span>
          <input
            type="date"
            className="min-h-11 rounded-[10px] border border-border bg-surface px-2 py-2 text-sm"
            value={filters.dateTo || ''}
            onChange={(e) => setFilters({ dateTo: e.target.value || null })}
          />
        </label>

        {/* Commune */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('commune' as Parameters<typeof t>[0])}</span>
          <input
            type="text"
            className="min-h-11 rounded-[10px] border border-border bg-surface px-2 py-2 text-sm"
            placeholder={t('commune' as Parameters<typeof t>[0])}
            value={filters.commune || ''}
            onChange={(e) => setFilters({ commune: e.target.value || null })}
          />
        </label>

        {/* Search */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('search')}</span>
          <input
            type="text"
            className="min-h-11 rounded-[10px] border border-border bg-surface px-2 py-2 text-sm"
            placeholder={t('search')}
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </label>

        {/* Sort */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('sortBy' as Parameters<typeof t>[0])}</span>
          <select
            className="min-h-11 rounded-[10px] border border-border bg-surface px-2 py-2 text-sm"
            value={filters.sortBy}
            onChange={(e) => setFilters({ sortBy: e.target.value as typeof filters.sortBy })}
          >
            <option value="createdAt">{t('date' as Parameters<typeof t>[0])}</option>
            <option value="burnAreaHa">{t('fireRecordBurnArea')}</option>
            <option value="alertReceivedAt">{t('fireRecordAlertReceived')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('sortOrder' as Parameters<typeof t>[0])}</span>
          <select
            className="min-h-11 rounded-[10px] border border-border bg-surface px-2 py-2 text-sm"
            value={filters.sortOrder}
            onChange={(e) => setFilters({ sortOrder: e.target.value as 'asc' | 'desc' })}
          >
            <option value="desc">{t('sortDesc' as Parameters<typeof t>[0])}</option>
            <option value="asc">{t('sortAsc' as Parameters<typeof t>[0])}</option>
          </select>
        </label>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="primary" className="min-h-11" onClick={handleApply}>
            {t('search')}
          </Button>
          <Button variant="secondary" className="min-h-11" onClick={() => { clearFilters(); fetchRecords(false); }}>
            {t('cancel')}
          </Button>
        </div>

        {/* View toggle */}
        <div className="col-span-full flex justify-end">
        <div className="flex gap-1 rounded-[10px] border border-border bg-surface-2 p-1" role="group" aria-label={t('viewMode' as Parameters<typeof t>[0])} data-testid="view-toggle">
          <button
            type="button"
            className={cn(
              'grid min-h-10 min-w-11 place-items-center rounded-lg px-2 py-1.5 text-sm transition-colors',
              viewMode === 'table' ? 'bg-primary text-primary-foreground shadow-elev-1' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={() => setViewMode('table' as ViewMode)}
            aria-pressed={viewMode === 'table'}
            aria-label={t('fireRecordViewTable' as Parameters<typeof t>[0])}
          >
            <Icon name="menu" size={16} />
          </button>
          <button
            type="button"
            className={cn(
              'grid min-h-10 min-w-11 place-items-center rounded-lg px-2 py-1.5 text-sm transition-colors',
              viewMode === 'map' ? 'bg-primary text-primary-foreground shadow-elev-1' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={() => setViewMode('map' as ViewMode)}
            aria-pressed={viewMode === 'map'}
            aria-label={t('fireRecordViewMap' as Parameters<typeof t>[0])}
          >
            <Icon name="map" size={16} />
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
