'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { RecordStatusBadge } from './RecordStatusBadge';
import { Button } from '@/components/ui/Button';

export function ComparisonView() {
  const { t } = useTranslation();
  const { comparisonRecords, clearComparison } = useFireRecordStore();

  if (comparisonRecords.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="comparison-view">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('comparisonTitle' as Parameters<typeof t>[0])}</h2>
        <Button variant="secondary" size="sm" onClick={clearComparison}>
          {t('close' as Parameters<typeof t>[0])}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground">{t('field' as Parameters<typeof t>[0])}</th>
              {comparisonRecords.map((r) => (
                <th key={r.id} className="px-3 py-2 font-medium text-muted-foreground">
                  {r.id.slice(-8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow
              label={t('fireRecordStatus')}
              values={comparisonRecords.map((r) => (
                <RecordStatusBadge key={r.id} status={r.recordStatus} />
              ))}
            />
            <ComparisonRow
              label={t('fireRecordBurnArea')}
              values={comparisonRecords.map((r) =>
                r.burnAreaHa != null ? `${r.burnAreaHa} ha` : '—'
              )}
            />
            <ComparisonRow
              label={t('fireRecordAlertSource')}
              values={comparisonRecords.map((r) => r.alertSource)}
            />
            <ComparisonRow
              label={t('commune' as Parameters<typeof t>[0])}
              values={comparisonRecords.map((r) => {
                const loc = r.locationDetail as Record<string, unknown> | null;
                return (loc?.commune as string) ?? '—';
              })}
            />
            <ComparisonRow
              label={t('fireRecordCause' as Parameters<typeof t>[0])}
              values={comparisonRecords.map((r) => {
                const cause = r.causeDetail as Record<string, unknown> | null;
                return (cause?.category as string) ?? '—';
              })}
            />
            <ComparisonRow
              label={t('responseTime' as Parameters<typeof t>[0])}
              values={comparisonRecords.map((r) => {
                const resp = r.responseDetail as Record<string, unknown> | null;
                return resp?.responseTimeMinutes ? `${resp.responseTimeMinutes} min` : '—';
              })}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonRow({ label, values }: { label: string; values: React.ReactNode[] }) {
  return (
    <tr className="border-b border-border/50">
      <td className="px-3 py-2 font-medium text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2">{v}</td>
      ))}
    </tr>
  );
}
