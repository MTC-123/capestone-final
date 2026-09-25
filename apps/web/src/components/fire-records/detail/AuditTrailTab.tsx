'use client';

import { useTranslation } from '@/hooks/useTranslation';
import type { AuditEntry } from '@/types';

interface Props {
  entries: AuditEntry[];
}

export function AuditTrailTab({ entries }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 p-4" data-testid="audit-tab" role="tabpanel" id="panel-audit">
      <h3 className="text-sm font-bold">{t('tabAuditTrail' as Parameters<typeof t>[0])}</h3>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noAuditEntries' as Parameters<typeof t>[0])}</p>
      ) : (
        <div className="space-y-2">
          {[...entries].reverse().map((entry, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface-2 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">{entry.action}</span>
                <span className="shrink-0 font-mono text-muted-foreground tabular">{formatTimestamp(entry.timestamp)}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground">
                {t('user' as Parameters<typeof t>[0])}: <span className="font-mono">{entry.cin}</span>
                {entry.section && ` — ${t('section' as Parameters<typeof t>[0])}: ${entry.section}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}
