'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { RecordStatusBadge } from './RecordStatusBadge';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

export function FireRecordTable() {
  const { t } = useTranslation();
  const { records, isLoading, pagination, fetchRecords } = useFireRecordStore();

  if (isLoading && records.length === 0) {
    return (
      <div className="p-6 space-y-3" aria-busy="true" aria-label={t('loading')}>
        <SkeletonBox className="h-10 rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBox key={i} className="h-12 rounded-xl" />
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
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border text-start">
              <th className="px-3 py-2 font-medium text-muted-foreground">{t('incident')}</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">{t('fireRecordStatus')}</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">{t('fireRecordAlertSource')}</th>
              <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t('fireRecordBurnArea')}</th>
              <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t('fireRecordLockedSections')}</th>
              <th className="px-3 py-2 font-medium text-muted-foreground" />
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b border-border/50 hover:bg-surface-2">
                <td className="px-3 py-2 font-mono text-xs tabular">{record.incidentId.slice(-8)}</td>
                <td className="px-3 py-2">
                  <RecordStatusBadge status={record.recordStatus} />
                </td>
                <td className="px-3 py-2 text-xs">{record.alertSource}</td>
                <td className="px-3 py-2 text-end font-mono text-xs tabular">
                  {record.burnAreaHa != null ? `${record.burnAreaHa} ha` : '-'}
                </td>
                <td className="px-3 py-2 text-end font-mono text-xs tabular">
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
          <Button variant="secondary" size="sm" onClick={() => fetchRecords(true)} disabled={isLoading}>
            {isLoading ? t('loading') : t('fireRecordLoadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
