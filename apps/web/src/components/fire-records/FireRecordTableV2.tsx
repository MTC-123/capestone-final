'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { InlineStatusUpdate } from './InlineStatusUpdate';
import { Icon } from '@/components/ui/Icon';

export function FireRecordTableV2() {
  const { t } = useTranslation();
  const {
    records, isLoading, pagination, fetchRecords,
    filters, setFilters,
    comparisonIds, toggleComparison,
  } = useFireRecordStore();

  const handleSort = (field: 'createdAt' | 'burnAreaHa' | 'alertReceivedAt') => {
    if (filters.sortBy === field) {
      setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      setFilters({ sortBy: field, sortOrder: 'desc' });
    }
    fetchRecords(false);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (filters.sortBy !== field) return null;
    return <Icon name={filters.sortOrder === 'asc' ? 'chevronUp' : 'chevronDown'} size={12} />;
  };

  if (isLoading && records.length === 0) {
    return (
      <div className="p-6 space-y-3" aria-busy="true" aria-label={t('loading')}>
        <div className="h-10 animate-pulse rounded-xl bg-muted" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-muted-foreground/10" />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground" data-testid="fire-record-empty">
        {t('fireRecordNoRecords')}
      </div>
    );
  }

  return (
    <div data-testid="fire-record-table-v2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 w-8">
                <span className="sr-only">{t('compare' as Parameters<typeof t>[0])}</span>
              </th>
              <th
                className="px-3 py-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => handleSort('createdAt')}
              >
                <span className="inline-flex items-center gap-1">
                  {t('date' as Parameters<typeof t>[0])}
                  <SortIcon field="createdAt" />
                </span>
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                {t('location' as Parameters<typeof t>[0])}
              </th>
              <th
                className="px-3 py-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => handleSort('burnAreaHa')}
              >
                <span className="inline-flex items-center gap-1">
                  {t('fireRecordBurnArea')}
                  <SortIcon field="burnAreaHa" />
                </span>
              </th>
              <th className="hidden md:table-cell px-3 py-2 font-medium text-muted-foreground">
                {t('fireRecordCause' as Parameters<typeof t>[0])}
              </th>
              <th className="hidden md:table-cell px-3 py-2 font-medium text-muted-foreground">
                {t('responseTime' as Parameters<typeof t>[0])}
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                {t('fireRecordStatus')}
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const loc = record.locationDetail as Record<string, unknown> | null;
              const cause = record.causeDetail as Record<string, unknown> | null;
              const resp = record.responseDetail as Record<string, unknown> | null;
              const date = record.alertReceivedAt || record.createdAt;
              const locationStr = (loc?.locationName ?? loc?.commune ?? formatCoords(loc?.coordinates)) as string || '—';
              const causeStr = cause?.category ? t(`cause${cause.category}` as Parameters<typeof t>[0]) : '—';
              const responseTime = resp?.responseTimeMinutes
                ? `${resp.responseTimeMinutes} min`
                : computeResponseTime(record.firstResponseAt, record.alertReceivedAt);
              const isSelected = comparisonIds.includes(record.id);

              return (
                <tr
                  key={record.id}
                  className={`border-b border-border/50 hover:bg-muted/30 ${isSelected ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-3 py-2">
                    <label className="inline-flex h-11 w-11 items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleComparison(record.id)}
                        disabled={!isSelected && comparisonIds.length >= 5}
                        className="rounded"
                        aria-label={`${t('compare' as Parameters<typeof t>[0])} ${record.id.slice(-8)}`}
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Link href={`/fire-database/${record.id}`} className="hover:underline">
                      {formatDate(date)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">{locationStr}</td>
                  <td className="px-3 py-2 text-xs">
                    {record.burnAreaHa != null ? `${record.burnAreaHa} ha` : '—'}
                  </td>
                  <td className="hidden md:table-cell px-3 py-2 text-xs">{causeStr}</td>
                  <td className="hidden md:table-cell px-3 py-2 text-xs">{responseTime}</td>
                  <td className="px-3 py-2">
                    <InlineStatusUpdate recordId={record.id} status={record.recordStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination.hasMore && (
        <div className="p-4 text-center">
          <button
            onClick={() => fetchRecords(true)}
            disabled={isLoading}
            className="rounded border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {isLoading ? t('loading') : t('fireRecordLoadMore')}
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function formatCoords(coords: unknown): string {
  if (!Array.isArray(coords) || coords.length !== 2) return '';
  return `${(coords[1] as number).toFixed(3)}, ${(coords[0] as number).toFixed(3)}`;
}

function computeResponseTime(firstResponse: string | null | undefined, alertReceived: string | null | undefined): string {
  if (!firstResponse || !alertReceived) return '—';
  const diff = (new Date(firstResponse).getTime() - new Date(alertReceived).getTime()) / 60000;
  if (diff <= 0 || isNaN(diff)) return '—';
  return `${Math.round(diff)} min`;
}
