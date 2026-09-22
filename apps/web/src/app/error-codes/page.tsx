'use client';

import * as React from 'react';
import { ERROR_CATALOG } from '@/lib/errors/catalog';
import { ERROR_CODE_RANGES } from '@/lib/errors/types';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from '@/hooks/useTranslation';

type RangeKey = keyof typeof ERROR_CODE_RANGES | 'ALL';

export default function ErrorCodesPage() {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [range, setRange] = React.useState<RangeKey>('ALL');

  const rangeLabel = React.useCallback(
    (key: RangeKey) => {
      if (key === 'CLIENT') return t('errorCodesRangeClient');
      if (key === 'AUTH') return t('errorCodesRangeAuth');
      if (key === 'BUSINESS') return t('errorCodesRangeBusiness');
      if (key === 'EXTERNAL') return t('errorCodesRangeExternal');
      if (key === 'SYSTEM') return t('errorCodesRangeSystem');
      return t('errorCodesRangeAll');
    },
    [t]
  );

  const entries = React.useMemo(() => {
    const list = Object.values(ERROR_CATALOG).sort((a, b) => a.code - b.code);
    const q = query.trim().toLowerCase();
    return list.filter((e) => {
      const inRange =
        range === 'ALL' ? true : e.code >= ERROR_CODE_RANGES[range].min && e.code <= ERROR_CODE_RANGES[range].max;
      if (!inRange) return false;
      if (!q) return true;
      return (
        String(e.code).includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.developerMessage.toLowerCase().includes(q) ||
        e.userMessageKey.toLowerCase().includes(q)
      );
    });
  }, [query, range]);

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t('errorCodesTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('errorCodesSubtitle')}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput
            label={t('search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('errorCodesSearchPlaceholder')}
          />
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm sm:w-56"
        >
          {(['ALL', 'CLIENT', 'AUTH', 'BUSINESS', 'EXTERNAL', 'SYSTEM'] as const).map((k) => (
            <option key={k} value={k}>
              {rangeLabel(k)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div className="grid grid-cols-12 border-b border-border bg-surface-2 px-4 py-3 text-xs font-bold text-muted-foreground">
          <div className="col-span-2">{t('errorCodesTableCode')}</div>
          <div className="col-span-4">{t('errorCodesTableName')}</div>
          <div className="col-span-2">{t('errorCodesTableSeverity')}</div>
          <div className="col-span-1">{t('errorCodesTableHttp')}</div>
          <div className="col-span-3">{t('errorCodesTableUserKey')}</div>
        </div>
        <div className="divide-y divide-border">
          {entries.map((e) => (
            <div key={e.code} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm">
              <div className="col-span-2 font-semibold text-foreground">{e.code}</div>
              <div className="col-span-4">
                <div className="font-semibold text-foreground">{e.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{e.developerMessage}</div>
              </div>
              <div className="col-span-2">
                <Badge tone={e.severity === 'CRITICAL' || e.severity === 'HIGH' ? 'danger' : e.severity === 'MEDIUM' ? 'warning' : 'success'}>
                  {e.severity}
                </Badge>
              </div>
              <div className="col-span-1 text-muted-foreground">{e.httpStatus}</div>
              <div className="col-span-3 text-muted-foreground">{e.userMessageKey}</div>
            </div>
          ))}
          {entries.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t('errorCodesEmpty')}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

