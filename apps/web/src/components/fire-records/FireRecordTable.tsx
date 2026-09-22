'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { RecordStatusBadge } from './RecordStatusBadge';

export function FireRecordTable() {
  const { t } = useTranslation();
  const { records, isLoading, pagination, fetchRecords } = useFireRecordStore();

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
    <div data-testid="fire-record-table">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground">{t('incident')}</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">{t('fireRecordStatus')}</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">{t('fireRecordAlertSource')}</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">{t('fireRecordBurnArea')}</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">{t('fireRecordLockedSections')}</th>
              <th className="px-3 py-2 font-medium text-muted-foreground" />
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{record.incidentId.slice(-8)}</td>
                <td className="px-3 py-2">
                  <RecordStatusBadge status={record.recordStatus} />
                </td>
                <td className="px-3 py-2 text-xs">{record.alertSource}</td>
                <td className="px-3 py-2 text-xs">
                  {record.burnAreaHa != null ? `${record.burnAreaHa} ha` : '-'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {record.lockedSections.length} / 5
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/fire-database/${record.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t('fireRecordViewFull')}
                  </Link>
                </td>
              </tr>
            ))}
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
