'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { Report } from '@/types';
import type { TranslationKey } from '@/i18n/translations';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { getApiErrorUserMessage } from '@/lib/errors/sdk';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { CreateIncidentModal } from '@/components/reports/CreateIncidentModal';
import { ReportPdfActions } from '@/components/reports/ReportPdfActions';
import { cn } from '@/lib/cn';

const FETCH_TIMEOUT_MS = 8000;
const PAGE_LIMIT = 20;

const CAUSE_LABEL_MAP: Record<string, TranslationKey> = {
  CAMPFIRE_UNATTENDED: 'campfireUnattended',
  CIGARETTE: 'cigarette',
  AGRICULTURAL_BURNING: 'agriculturalBurning',
  ELECTRICAL: 'electrical',
  LIGHTNING: 'lightning',
  ARSON: 'arson',
  EQUIPMENT_MALFUNCTION: 'equipmentMalfunction',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

const SIZE_LABELS: Record<string, TranslationKey> = {
  small: 'sizeSmall',
  medium: 'sizeMedium',
  large: 'sizeLarge',
  very_large: 'sizeVeryLarge',
};
const SMOKE_LABELS: Record<string, TranslationKey> = {
  none: 'smokeNone',
  light: 'smokeLight',
  moderate: 'smokeModerate',
  heavy: 'smokeHeavy',
};
const TYPE_LABELS: Record<string, TranslationKey> = {
  ground: 'typeGround',
  surface: 'typeSurface',
  crown: 'typeCrown',
  unknown: 'typeUnknown',
};
const WIND_LABELS: Record<string, TranslationKey> = {
  calm: 'windCalm',
  light: 'windLight',
  moderate: 'windModerate',
  strong: 'windStrong',
};
const THREAT_LABELS: Record<string, TranslationKey> = {
  structures: 'threatStructures',
  roads: 'threatRoads',
  powerlines: 'threatPowerlines',
  forest: 'threatForest',
  people: 'threatPeople',
};

function statusClasses(status: string) {
  if (status === 'PENDING') return 'border-danger/20 bg-danger-muted text-danger-foreground';
  if (status === 'IN_PROGRESS') return 'border-warning/20 bg-warning-muted text-warning-foreground';
  if (status === 'COMPLETED') return 'border-success/20 bg-success-muted text-success-foreground';
  return 'border-border bg-muted text-muted-foreground';
}

function formatCoordinates(latitude: unknown, longitude: unknown, fallback: string) {
  const lat = typeof latitude === 'number' ? latitude : Number(latitude);
  const lng = typeof longitude === 'number' ? longitude : Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fallback;
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function getCharacteristicValue(
  value: unknown,
  labels: Record<string, TranslationKey>,
  t: (key: TranslationKey) => string,
  fallback: string
) {
  if (typeof value !== 'string') return fallback;
  const key = labels[value];
  return key ? t(key) : value;
}

function getThreatValues(value: unknown, t: (key: TranslationKey) => string, fallback: string) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value
    .map((item) => (typeof item === 'string' && THREAT_LABELS[item] ? t(THREAT_LABELS[item]) : String(item)))
    .join(', ');
}

export default function ReportsListPage() {
  const user = useAuthStore((state) => state.user);
  const { t, language } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportToConvert, setReportToConvert] = useState<Report | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState('');
  const [causeFilter, setCauseFilter] = useState('');
  const [query, setQuery] = useState('');

  const isRTL = language === 'ar';
  const isOfficial = user?.role === 'OFFICIAL';
  const textAlign = isRTL ? 'text-right' : 'text-left';
  const errorServerMessage = t('errorServer');
  const connectionErrorMessage = t('connectionError');

  const getStatusLabel = useCallback((status: string) => {
    if (status === 'PENDING') return t('pending');
    if (status === 'IN_PROGRESS') return t('inProgress');
    if (status === 'COMPLETED') return t('completed');
    return status;
  }, [t]);

  const getCauseLabel = useCallback((causeKey: string | undefined | null) => {
    if (!causeKey) return t('unknown');
    return t(CAUSE_LABEL_MAP[causeKey] ?? 'unknown');
  }, [t]);

  const formatDate = useCallback((dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const locale = language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US';
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [language]);

  const fetchReports = useCallback(async (append = false, nextCursor: string | null = null) => {
    if (!append) {
      abortRef.current?.abort();
    }
    const controller = new AbortController();
    if (!append) {
      abortRef.current = controller;
    }

    setError(null);
    setTimedOut(false);
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    const timer = setTimeout(() => {
      controller.abort();
      setTimedOut(true);
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }, FETCH_TIMEOUT_MS);

    try {
      const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
      if (append && nextCursor) params.set('cursor', nextCursor);
      if (statusFilter) params.set('status', statusFilter);
      if (causeFilter) params.set('cause', causeFilter);

      const response = await fetchWithAuth(`/api/reports?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timer);
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        if (!append) setReports([]);
        setError(getApiErrorUserMessage(data, errorServerMessage));
        return;
      }

      const payload = data as { data?: Report[]; pagination?: { cursor: string | null; hasMore: boolean; total: number } };
      const nextReports = Array.isArray(payload?.data) ? payload.data : [];
      const pagination = payload?.pagination;

      setReports((prev) => append ? [...prev, ...nextReports] : nextReports);
      setCursor(pagination?.cursor ?? null);
      setHasMore(pagination?.hasMore ?? false);
      setTotal(pagination?.total ?? nextReports.length);
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error)?.name === 'AbortError') return;
      if (!append) setReports([]);
      setError(connectionErrorMessage);
    } finally {
      clearTimeout(timer);
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [causeFilter, connectionErrorMessage, errorServerMessage, statusFilter]);

  useEffect(() => {
    fetchReports(false);
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchReports]);

  const handleStatusUpdate = async (reportId: string, newStatus: Report['status']) => {
    setUpdatingId(reportId);
    setError(null);
    try {
      const response = await fetchWithAuth(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setError(getApiErrorUserMessage(data, errorServerMessage));
        return;
      }

      const updatedReport = (data as { report?: unknown })?.report as Report | undefined;
      if (!updatedReport?.id) {
        setError(errorServerMessage);
        return;
      }

      setReports((prev) => prev
        .map((report) => (report.id === reportId ? updatedReport : report))
        .filter((report) => !statusFilter || report.status === statusFilter));
      setSelectedReport((prev) => (prev?.id === reportId ? updatedReport : prev));
    } catch {
      setError(connectionErrorMessage);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return reports;
    return reports.filter((report) => {
      const haystack = [
        report.referenceNumber,
        report.description,
        report.user?.cin,
        getCauseLabel(report.cause),
        formatCoordinates(report.latitude, report.longitude, t('unknown')),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [getCauseLabel, query, reports, t]);

  const stats = useMemo(() => ({
    total: total || reports.length,
    pending: reports.filter((report) => report.status === 'PENDING').length,
    inProgress: reports.filter((report) => report.status === 'IN_PROGRESS').length,
    completed: reports.filter((report) => report.status === 'COMPLETED').length,
  }), [reports, total]);

  const statusOptions = [
    { value: '', label: t('allStatuses') },
    { value: 'PENDING', label: t('pending') },
    { value: 'IN_PROGRESS', label: t('inProgress') },
    { value: 'COMPLETED', label: t('completed') },
  ];

  const causeOptions = [
    { value: '', label: t('allCauses') },
    { value: 'CAMPFIRE_UNATTENDED', label: t('campfireUnattended') },
    { value: 'CIGARETTE', label: t('cigarette') },
    { value: 'AGRICULTURAL_BURNING', label: t('agriculturalBurning') },
    { value: 'ELECTRICAL', label: t('electrical') },
    { value: 'LIGHTNING', label: t('lightning') },
    { value: 'ARSON', label: t('arson') },
    { value: 'EQUIPMENT_MALFUNCTION', label: t('equipmentMalfunction') },
    { value: 'OTHER', label: t('other') },
    { value: 'UNKNOWN', label: t('unknown') },
  ];

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 page-enter" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className={textAlign}>
          <p className="mb-2 text-xs font-bold uppercase text-primary">
            {isOfficial ? t('reportsOfficialScope') : t('reportsCitizenScope')}
          </p>
          <h1 className="text-fluid-4xl font-bold text-foreground">
            {t('reportsListTitle')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t('reportsListDesc')}
          </p>
        </div>
        <Link href="/report" className="shrink-0">
          <Button variant="primary" className="w-full sm:w-auto">
            <Icon name="campaign" size={16} />
            {t('newReport')}
          </Button>
        </Link>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('reportsSummary')}>
        <SummaryTile label={t('reportsSummaryTotal')} value={stats.total} icon="clipboard" />
        <SummaryTile label={t('pending')} value={stats.pending} tone="danger" />
        <SummaryTile label={t('inProgress')} value={stats.inProgress} tone="warning" />
        <SummaryTile label={t('completed')} value={stats.completed} tone="success" />
      </section>

      <Card tone="subtle" className="mb-5 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto] lg:items-end">
          <div>
            <label htmlFor="report-search" className="mb-2 block text-sm font-semibold text-foreground">
              {t('searchReports')}
            </label>
            <div className="relative">
              <Icon name="search" size={16} aria-hidden className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground', isRTL ? 'right-3' : 'left-3')} />
              <input
                id="report-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchReportsPlaceholder')}
                className={cn(
                  'h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring',
                  isRTL ? 'pr-9 text-right' : 'pl-9'
                )}
              />
            </div>
          </div>
          <SelectField
            id="status-filter"
            label={t('filterByStatus')}
            options={statusOptions}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
          <SelectField
            id="cause-filter"
            label={t('filterByCause')}
            options={causeOptions}
            value={causeFilter}
            onChange={(event) => setCauseFilter(event.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setQuery('');
              setStatusFilter('');
              setCauseFilter('');
            }}
            disabled={!query && !statusFilter && !causeFilter}
          >
            <Icon name="refresh" size={16} />
            {t('clearFilters')}
          </Button>
        </div>
      </Card>

      {(error || timedOut) && !loading && (
        <Card tone="elevated" className="mb-6 p-6" role="alert">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Icon name="warning" aria-hidden size={28} className="text-danger" />
              <div>
                <p className="font-semibold text-foreground">{t('errorLoadingReports')}</p>
                <p className="text-sm text-muted-foreground">{error ?? t('loadingReportsTimeout')}</p>
              </div>
            </div>
            <Button onClick={() => fetchReports(false)} variant="primary">
              {t('retry')}
            </Button>
          </div>
        </Card>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-3" aria-busy="true" aria-label={t('loadingReports')}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border/60 bg-surface p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-6 w-28 skeleton-shimmer rounded-full" />
                <div className="h-4 w-40 skeleton-shimmer rounded-lg" />
              </div>
              <div className="h-5 w-2/3 skeleton-shimmer rounded-lg" />
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="h-12 skeleton-shimmer rounded-lg" />
                <div className="h-12 skeleton-shimmer rounded-lg" />
                <div className="h-12 skeleton-shimmer rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && !timedOut && filteredReports.length === 0 && (
        <Card tone="elevated" className="p-10 text-center">
          <div className="mb-4 flex justify-center text-muted-foreground">
            <Icon name="clipboard" aria-hidden size={48} />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {query || statusFilter || causeFilter ? t('noReportsMatch') : t('noReports')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {query || statusFilter || causeFilter ? t('noReportsMatchDesc') : t('noReportsDesc')}
          </p>
          <Link href="/report" className="mt-6 inline-flex">
            <Button variant="primary">
              <Icon name="campaign" size={16} />
              {t('createFirstReport')}
            </Button>
          </Link>
        </Card>
      )}

      {!loading && filteredReports.length > 0 && (
        <div className="space-y-3" data-testid="reports-board">
          {filteredReports.map((report) => (
            <Card
              key={report.id}
              tone="default"
              data-testid="report-card"
              className="cursor-pointer overflow-hidden hover:border-primary/30"
              onClick={() => setSelectedReport(report)}
            >
              <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-bold', statusClasses(report.status))}>
                      {getStatusLabel(report.status)}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                      {report.referenceNumber || report.id.slice(-8)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(report.createdAt)}
                    </span>
                    {report.incidentId && (
                      <Badge tone="success">{t('incidentLinked')}</Badge>
                    )}
                  </div>

                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {report.description}
                  </p>

                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                    <MetaItem icon="fire" label={t('cause')} value={getCauseLabel(report.cause)} />
                    <MetaItem icon="mapPin" label={t('location')} value={formatCoordinates(report.latitude, report.longitude, t('unknown'))} />
                    <MetaItem icon="id" label={t('reporter')} value={report.anonymous ? t('anonymousReport') : report.user?.cin || t('unknown')} />
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:w-80">
                  <ReportPdfActions reportId={report.id} compact />
                  <Button
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedReport(report);
                    }}
                    className="w-full"
                  >
                    <Icon name="eye" size={16} />
                    {t('openReportDetails')}
                  </Button>
                </div>
              </div>

              {isOfficial && (
                <div className="border-t border-border/60 bg-surface-2/60 p-3">
                  <div className="grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="grid gap-2 sm:grid-cols-3" aria-busy={updatingId === report.id}>
                      {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((status) => (
                        <Button
                          key={status}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleStatusUpdate(report.id, status);
                          }}
                          disabled={report.status === status || updatingId === report.id}
                          variant="secondary"
                          size="sm"
                          className={cn(
                            'w-full',
                            status === 'PENDING' && 'text-danger-foreground',
                            status === 'IN_PROGRESS' && 'text-warning-foreground',
                            status === 'COMPLETED' && 'text-success-foreground'
                          )}
                        >
                          {getStatusLabel(status)}
                        </Button>
                      ))}
                    </div>
                    {!report.incidentId ? (
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          setReportToConvert(report);
                        }}
                        variant="primary"
                        size="sm"
                      >
                        <Icon name="fire" size={15} />
                        {t('createIncident')}
                      </Button>
                    ) : (
                      <span className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg bg-success-muted px-3 text-xs font-bold text-success-foreground">
                        <Icon name="check-circle" size={15} />
                        {t('incidentCreated')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-8 flex justify-center">
          <Button onClick={() => fetchReports(true, cursor)} variant="secondary" isLoading={loadingMore} disabled={loadingMore}>
            {loadingMore ? t('loading') : t('loadMore')}
          </Button>
        </div>
      )}

      <ReportDetailDialog
        report={selectedReport}
        open={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        formatDate={formatDate}
        getCauseLabel={getCauseLabel}
        getStatusLabel={getStatusLabel}
      />

      <CreateIncidentModal
        report={reportToConvert}
        open={!!reportToConvert}
        onClose={() => setReportToConvert(null)}
        onSuccess={() => {
          setReportToConvert(null);
          fetchReports(false);
        }}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
  icon?: 'clipboard';
}) {
  return (
    <Card tone="subtle" className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={cn(
          'grid h-10 w-10 place-items-center rounded-lg',
          tone === 'neutral' && 'bg-primary-muted text-primary',
          tone === 'danger' && 'bg-danger-muted text-danger-foreground',
          tone === 'warning' && 'bg-warning-muted text-warning-foreground',
          tone === 'success' && 'bg-success-muted text-success-foreground'
        )}>
          {icon ? <Icon name={icon} size={18} aria-hidden /> : <span className="h-2.5 w-2.5 rounded-full bg-current" />}
        </div>
      </div>
    </Card>
  );
}

function MetaItem({ icon, label, value }: { icon: 'fire' | 'mapPin' | 'id'; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
      <Icon name={icon} size={15} aria-hidden className="text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ReportDetailDialog({
  report,
  open,
  onClose,
  formatDate,
  getCauseLabel,
  getStatusLabel,
}: {
  report: Report | null;
  open: boolean;
  onClose: () => void;
  formatDate: (date: string | Date) => string;
  getCauseLabel: (cause: string | undefined | null) => string;
  getStatusLabel: (status: string) => string;
}) {
  const { t, language } = useTranslation();
  if (!open || !report) return null;

  const characteristics = report.characteristics ?? {};
  const rtl = language === 'ar';
  const fallback = t('unknown');

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="report-detail-title" data-testid="report-detail-dialog">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg border border-border/60 bg-surface shadow-elev-3 sm:mx-auto sm:max-w-3xl sm:rounded-lg" dir={rtl ? 'rtl' : 'ltr'}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border/60 bg-surface/95 p-4 backdrop-blur">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-primary">{report.referenceNumber || report.id.slice(-8)}</p>
            <h2 id="report-detail-title" className="text-xl font-bold text-foreground">{t('reportDetails')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(report.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t('closePanel')}
          >
            <Icon name="close" size={20} aria-hidden />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-bold', statusClasses(report.status))}>
              {getStatusLabel(report.status)}
            </span>
            {report.incidentId && <Badge tone="success">{t('incidentLinked')}</Badge>}
            {report.anonymous && <Badge tone="neutral">{t('anonymousReport')}</Badge>}
          </div>

          <ReportPdfActions reportId={report.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label={t('reporter')} value={report.anonymous ? t('anonymousReport') : report.user?.cin || fallback} />
            <DetailField label={t('contactPhone')} value={report.contactPhone || report.user?.phone || fallback} />
            <DetailField label={t('cause')} value={getCauseLabel(report.cause)} />
            <DetailField label={t('location')} value={formatCoordinates(report.latitude, report.longitude, fallback)} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-foreground">{t('description')}</h3>
            <p className="whitespace-pre-wrap rounded-lg border border-border/60 bg-surface-2 p-4 text-sm leading-6 text-foreground">
              {report.description}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-foreground">{t('fireSize')}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailField label={t('fireSize')} value={getCharacteristicValue(characteristics.fireSize, SIZE_LABELS, t, fallback)} />
              <DetailField label={t('smokeLevel')} value={getCharacteristicValue(characteristics.smokeLevel, SMOKE_LABELS, t, fallback)} />
              <DetailField label={t('fireType')} value={getCharacteristicValue(characteristics.fireType, TYPE_LABELS, t, fallback)} />
              <DetailField label={t('windCondition')} value={getCharacteristicValue(characteristics.windCondition, WIND_LABELS, t, fallback)} />
              <div className="sm:col-span-2">
                <DetailField label={t('nearbyThreats')} value={getThreatValues(characteristics.nearbyThreats, t, fallback)} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-foreground">{t('addPhotos')}</h3>
            {report.images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {report.images.map((src, index) => (
                  <div key={index} className="aspect-video overflow-hidden rounded-lg border border-border/60 bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${t('addPhotos')} ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-border/60 bg-surface-2 p-4 text-sm text-muted-foreground">{t('noPhotos')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
