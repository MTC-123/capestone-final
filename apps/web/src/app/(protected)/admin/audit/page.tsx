'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebounce } from '@/hooks/useDebounce';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { getApiErrorUserMessage } from '@/lib/errors/sdk';
import { PageHeader, PageContainer } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { AuditTable, type AuditLogItem } from '@/components/admin/AuditTable';
import { DeliveryTable, type NotificationDeliveryItem } from '@/components/admin/DeliveryTable';
import { getActionLabel, toCsv } from '@/components/admin/formatters';
import { cn } from '@/lib/cn';

const ACTION_CATEGORIES = [
  { value: '', key: 'auditFilterAllActions' as const },
  { value: 'auth.*', key: 'auditFilterAuth' as const },
  { value: 'report.*', key: 'auditFilterReport' as const },
  { value: 'dispatch.*', key: 'auditFilterDispatch' as const },
  { value: 'official_request.*', key: 'auditFilterOfficialRequest' as const },
  { value: 'upload.*', key: 'auditFilterUpload' as const },
  { value: 'fire_record.*', key: 'auditFilterFireRecord' as const },
];

const PAGE_LIMIT = 50;

type Tab = 'log' | 'notifications';

export default function AdminAuditPage() {
  const role = useAuthStore((s) => s.user?.role);
  const { t, language } = useTranslation();

  const [tab, setTab] = useState<Tab>('log');

  // Audit log state
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [actorSearch, setActorSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const debouncedActor = useDebounce(actorSearch, 350);
  const debouncedTarget = useDebounce(targetSearch, 350);

  // Notifications state
  const [deliveries, setDeliveries] = useState<NotificationDeliveryItem[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);

  const errorServerMessage = t('errorServer');
  const connectionErrorMessage = t('connectionError');
  const requestSeq = useRef(0);

  const buildParams = useCallback(
    (cursor: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
      if (cursor) params.set('cursor', cursor);
      if (actionFilter) params.set('action', actionFilter);
      if (outcomeFilter) params.set('outcome', outcomeFilter);
      if (debouncedActor.trim()) params.set('actor', debouncedActor.trim());
      if (debouncedTarget.trim()) params.set('targetId', debouncedTarget.trim());
      return params;
    },
    [actionFilter, outcomeFilter, debouncedActor, debouncedTarget]
  );

  const loadFirstPage = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/admin/audit?${buildParams(null).toString()}`);
      const data = (await res.json().catch(() => null)) as unknown;
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(getApiErrorUserMessage(data, errorServerMessage));
        setItems([]);
        setNextCursor(null);
        return;
      }
      const payload = data as { items?: AuditLogItem[]; nextCursor?: string | null };
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setNextCursor(payload?.nextCursor ?? null);
    } catch {
      if (seq !== requestSeq.current) return;
      setError(connectionErrorMessage);
      setItems([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [buildParams, errorServerMessage, connectionErrorMessage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchWithAuth(`/api/admin/audit?${buildParams(nextCursor).toString()}`);
      const data = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        setError(getApiErrorUserMessage(data, errorServerMessage));
        return;
      }
      const payload = data as { items?: AuditLogItem[]; nextCursor?: string | null };
      setItems((prev) => [...prev, ...(Array.isArray(payload?.items) ? payload.items : [])]);
      setNextCursor(payload?.nextCursor ?? null);
    } catch {
      setError(connectionErrorMessage);
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, nextCursor, errorServerMessage, connectionErrorMessage]);

  useEffect(() => {
    if (role !== 'OFFICIAL') return;
    loadFirstPage();
  }, [loadFirstPage, role]);

  const loadDeliveries = useCallback(async () => {
    setDeliveriesLoading(true);
    setDeliveriesError(null);
    try {
      const res = await fetchWithAuth('/api/notifications/deliveries?limit=100');
      const data = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        setDeliveriesError(getApiErrorUserMessage(data, errorServerMessage));
        setDeliveries([]);
        return;
      }
      const payload = data as { deliveries?: NotificationDeliveryItem[] };
      setDeliveries(Array.isArray(payload?.deliveries) ? payload.deliveries : []);
    } catch {
      setDeliveriesError(connectionErrorMessage);
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  }, [errorServerMessage, connectionErrorMessage]);

  useEffect(() => {
    if (role !== 'OFFICIAL' || tab !== 'notifications') return;
    loadDeliveries();
  }, [loadDeliveries, role, tab]);

  const outcomeOptions = useMemo(
    () => [
      { value: '', label: t('auditFilterAllOutcomes') },
      { value: 'SUCCESS', label: t('auditOutcomeSuccess') },
      { value: 'DENIED', label: t('auditOutcomeDenied') },
      { value: 'FAILURE', label: t('auditOutcomeFailure') },
    ],
    [t]
  );

  const actionOptions = useMemo(
    () => ACTION_CATEGORIES.map((c) => ({ value: c.value, label: t(c.key) })),
    [t]
  );

  const handleExportCsv = () => {
    const headers = [
      t('auditColTime'),
      t('auditColActor'),
      'CIN',
      'Role',
      t('auditColAction'),
      t('auditColTarget'),
      t('auditColOutcome'),
      t('auditColIp'),
    ];
    const rows = items.map((item) => [
      item.createdAt,
      item.actorId ?? '',
      item.actorCin ?? '',
      item.actorRole ?? '',
      `${getActionLabel(item.action, t)} (${item.action})`,
      [item.targetType, item.targetId].filter(Boolean).join(':'),
      item.outcome,
      item.ip ?? '',
    ]);
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (role !== 'OFFICIAL') {
    return <AccessDenied />;
  }

  return (
    <PageContainer wide>
      <PageHeader
        eyebrow={t('navSectionAdmin')}
        title={t('adminAuditTitle')}
        description={t('adminAuditDesc')}
        actions={
          tab === 'log' ? (
            <Button variant="secondary" onClick={handleExportCsv} disabled={items.length === 0}>
              <Icon name="download" size={16} />
              {t('adminExportCsv')}
            </Button>
          ) : undefined
        }
      />

      <div role="tablist" aria-label={t('adminAuditTitle')} className="mb-5 inline-flex gap-1 rounded-[10px] border border-border bg-surface-2 p-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'log'}
          onClick={() => setTab('log')}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors',
            tab === 'log' ? 'bg-primary text-primary-foreground shadow-elev-1' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Icon name="audit" size={14} className="me-1.5 inline" />
          {t('adminTabAuditLog')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notifications'}
          onClick={() => setTab('notifications')}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors',
            tab === 'notifications' ? 'bg-primary text-primary-foreground shadow-elev-1' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Icon name="notifications" size={14} className="me-1.5 inline" />
          {t('adminTabNotifications')}
        </button>
      </div>

      {tab === 'log' && (
        <>
          <Card tone="subtle" className="mb-5 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                id="audit-action-filter"
                label={t('auditFilterActionLabel')}
                options={actionOptions}
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                leadingIcon="filter"
              />
              <SelectField
                id="audit-outcome-filter"
                label={t('auditFilterOutcomeLabel')}
                options={outcomeOptions}
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
              />
              <TextField
                id="audit-actor-filter"
                label={t('auditFilterActorLabel')}
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
                placeholder={t('auditFilterActorPlaceholder')}
                leadingIcon="search"
                inputClassName="font-mono"
              />
              <TextField
                id="audit-target-filter"
                label={t('auditFilterTargetLabel')}
                value={targetSearch}
                onChange={(e) => setTargetSearch(e.target.value)}
                placeholder={t('auditFilterTargetPlaceholder')}
                leadingIcon="search"
                inputClassName="font-mono"
              />
            </div>
          </Card>

          {error && !loading && (
            <Card tone="elevated" className="mb-5 p-6" role="alert">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Icon name="warning" aria-hidden size={24} className="text-danger" />
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button onClick={loadFirstPage} variant="primary">
                  {t('retry')}
                </Button>
              </div>
            </Card>
          )}

          {loading && (
            <div className="space-y-2" aria-busy="true" aria-label={t('loading')}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBox key={i} className="h-11 w-full" />
              ))}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center px-6 py-20 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
                <Icon name="audit" size={26} />
              </span>
              <h2 className="mt-6 text-lg font-semibold tracking-tight">{t('auditEmptyTitle')}</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('auditEmptyBody')}</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <AuditTable items={items} language={language} />
              <div className="mt-4 flex justify-center">
                {nextCursor ? (
                  <Button variant="secondary" onClick={loadMore} isLoading={loadingMore}>
                    {t('loadMore')}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('auditNoMoreResults')}</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'notifications' && (
        <>
          {deliveriesError && !deliveriesLoading && (
            <Card tone="elevated" className="mb-5 p-6" role="alert">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Icon name="warning" aria-hidden size={24} className="text-danger" />
                  <p className="text-sm text-muted-foreground">{deliveriesError}</p>
                </div>
                <Button onClick={loadDeliveries} variant="primary">
                  {t('retry')}
                </Button>
              </div>
            </Card>
          )}

          {deliveriesLoading && (
            <div className="space-y-2" aria-busy="true" aria-label={t('loading')}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBox key={i} className="h-11 w-full" />
              ))}
            </div>
          )}

          {!deliveriesLoading && !deliveriesError && <DeliveryTable items={deliveries} language={language} />}
        </>
      )}
    </PageContainer>
  );
}
