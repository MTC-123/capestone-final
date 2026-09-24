'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useToastStore } from '@/store/useToastStore';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { getApiErrorCode, getApiErrorUserMessage } from '@/lib/errors/sdk';
import { PageHeader, PageContainer } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { SkeletonBox, SkeletonText } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { formatRelativeTime, formatLocalDateTime } from '@/components/admin/formatters';
import { cn } from '@/lib/cn';

type OfficialRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type OfficialRequestUser = {
  id: string;
  cin: string;
  fullName?: string | null;
  phone: string;
  email?: string | null;
  role: string;
  createdAt: string;
};

type OfficialRequest = {
  id: string;
  department: string;
  position?: string | null;
  justification?: string | null;
  status: OfficialRequestStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  user: OfficialRequestUser;
};

type FilterTab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

const FILTERS: FilterTab[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

function statusTone(status: OfficialRequestStatus): 'warning' | 'success' | 'danger' {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  return 'warning';
}

export default function AdminApprovalsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const { t, language } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const isRTL = language === 'ar';

  const [filter, setFilter] = useState<FilterTab>('PENDING');
  const [items, setItems] = useState<OfficialRequest[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [decisionTarget, setDecisionTarget] = useState<{ item: OfficialRequest; decision: 'APPROVE' | 'REJECT' } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  const errorServerMessage = t('errorServer');
  const connectionErrorMessage = t('connectionError');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filter === 'ALL' ? '' : `?status=${filter}`;
      const res = await fetchWithAuth(`/api/admin/official-requests${params}`);
      const data = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        setError(getApiErrorUserMessage(data, errorServerMessage));
        setItems([]);
        return;
      }
      const payload = data as { items?: OfficialRequest[]; pending?: number };
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setPending(payload?.pending ?? 0);
    } catch {
      setError(connectionErrorMessage);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter, errorServerMessage, connectionErrorMessage]);

  useEffect(() => {
    if (role !== 'OFFICIAL') return;
    load();
  }, [load, role]);

  const getStatusLabel = useCallback(
    (status: OfficialRequestStatus) => {
      if (status === 'APPROVED') return t('adminStatusApproved');
      if (status === 'REJECTED') return t('adminStatusRejected');
      return t('adminStatusPending');
    },
    [t]
  );

  const openDecision = (item: OfficialRequest, decision: 'APPROVE' | 'REJECT') => {
    setDecisionTarget({ item, decision });
  };

  const closeDecision = () => {
    if (submitting) return;
    setDecisionTarget(null);
  };

  const handleConfirm = async (note: string) => {
    if (!decisionTarget) return;
    const { item, decision } = decisionTarget;
    setSubmitting(true);

    // Optimistic update
    const previousItems = items;
    const previousPending = pending;
    const nextStatus: OfficialRequestStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    setItems((prev) =>
      filter === 'PENDING'
        ? prev.filter((r) => r.id !== item.id)
        : prev.map((r) => (r.id === item.id ? { ...r, status: nextStatus, reviewNote: note || null } : r))
    );
    setPending((p) => Math.max(0, p - 1));

    try {
      const res = await fetchWithAuth(`/api/admin/official-requests/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const code = getApiErrorCode(data);
        setItems(previousItems);
        setPending(previousPending);
        if (code === 3000) {
          addToast(t('adminErrorAlreadyDecided'), 'warning');
          load();
        } else if (code === 2001) {
          addToast(t('adminErrorOwnRequest'), 'error');
        } else {
          addToast(getApiErrorUserMessage(data, errorServerMessage), 'error');
        }
        return;
      }

      addToast(
        decision === 'APPROVE' ? t('adminToastApproved') : t('adminToastRejected'),
        'success'
      );
      setDecisionTarget(null);
      load();
    } catch {
      setItems(previousItems);
      setPending(previousPending);
      addToast(t('connectionError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingLabel = useMemo(() => t('adminApprovalsPendingCount').replace('{count}', String(pending)), [pending, t]);

  if (role !== 'OFFICIAL') {
    return <AccessDenied />;
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t('navSectionAdmin')}
        title={t('adminApprovalsTitle')}
        description={t('adminApprovalsDesc')}
        actions={
          <Badge tone={pending > 0 ? 'warning' : 'neutral'}>
            <Icon name="clock" size={12} />
            {pendingLabel}
          </Badge>
        }
      />

      <div
        role="group"
        aria-label={t('adminFilterByStatus')}
        className="mb-5 inline-flex flex-wrap gap-1 rounded-[10px] border border-border bg-surface-2 p-1"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors',
              filter === f
                ? 'bg-primary text-primary-foreground shadow-elev-1'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {f === 'PENDING' && t('adminStatusPending')}
            {f === 'APPROVED' && t('adminStatusApproved')}
            {f === 'REJECTED' && t('adminStatusRejected')}
            {f === 'ALL' && t('adminFilterAll')}
          </button>
        ))}
      </div>

      {error && !loading && (
        <Card tone="elevated" className="mb-6 p-6" role="alert">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Icon name="warning" aria-hidden size={24} className="text-danger" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={load} variant="primary">
              {t('retry')}
            </Button>
          </div>
        </Card>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-3" aria-busy="true" aria-label={t('loading')}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} tone="subtle" className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <SkeletonBox className="h-6 w-24 rounded-full" />
                <SkeletonBox className="h-4 w-32" />
              </div>
              <SkeletonText lines={2} className="mb-3" />
              <SkeletonBox className="h-8 w-full max-w-sm" />
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
            <Icon name="userCheck" size={26} />
          </span>
          <h2 className="mt-6 text-lg font-semibold tracking-tight">{t('adminApprovalsEmptyTitle')}</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('adminApprovalsEmptyBody')}</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card tone="default" className="p-4 sm:p-5">
                <div className={cn('flex flex-col gap-4', isRTL ? 'text-right' : 'text-left')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-bold text-foreground">
                          {item.user.fullName || item.user.cin}
                        </h3>
                        <Badge tone={statusTone(item.status)}>{getStatusLabel(item.status)}</Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{item.user.cin}</p>
                    </div>
                    <time
                      dateTime={item.createdAt}
                      title={formatLocalDateTime(item.createdAt, language)}
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      {formatRelativeTime(item.createdAt, language)}
                    </time>
                  </div>

                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('department')}
                      </dt>
                      <dd className="text-foreground">{item.department || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('position')}
                      </dt>
                      <dd className="text-foreground">{item.position || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('phone')}
                      </dt>
                      <dd className="text-foreground">{item.user.phone || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('adminEmail')}
                      </dt>
                      <dd className="truncate text-foreground">{item.user.email || '—'}</dd>
                    </div>
                  </dl>

                  {item.justification && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('adminJustification')}
                      </dt>
                      <p className="mt-1 text-sm text-foreground">{item.justification}</p>
                    </div>
                  )}

                  {item.status !== 'PENDING' && item.reviewNote && (
                    <div className="rounded-lg border border-border/60 bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                      {t('adminReviewNoteLabel')}: {item.reviewNote}
                    </div>
                  )}

                  {item.status === 'PENDING' && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" onClick={() => openDecision(item, 'APPROVE')}>
                        <Icon name="check" size={16} />
                        {t('adminApprove')}
                      </Button>
                      <Button variant="danger" onClick={() => openDecision(item, 'REJECT')}>
                        <Icon name="close" size={16} />
                        {t('adminReject')}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {decisionTarget && (
        <ConfirmDialog
          open={!!decisionTarget}
          title={
            decisionTarget.decision === 'APPROVE'
              ? t('adminConfirmApproveTitle')
              : t('adminConfirmRejectTitle')
          }
          description={(decisionTarget.item.user.fullName || decisionTarget.item.user.cin) || undefined}
          noteRequired={decisionTarget.decision === 'REJECT'}
          noteLabel={decisionTarget.decision === 'REJECT' ? t('adminRejectReasonLabel') : t('adminReviewNoteLabel')}
          confirmLabel={decisionTarget.decision === 'APPROVE' ? t('adminApprove') : t('adminReject')}
          tone={decisionTarget.decision === 'APPROVE' ? 'primary' : 'danger'}
          isSubmitting={submitting}
          onConfirm={handleConfirm}
          onCancel={closeDecision}
        />
      )}
    </PageContainer>
  );
}
