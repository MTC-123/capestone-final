'use client';

import { Fragment, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { getActionLabel, formatLocalDateTime, formatRelativeTime } from '@/components/admin/formatters';
import { cn } from '@/lib/cn';

export type AuditLogItem = {
  id: string;
  actorId?: string | null;
  actorCin?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

function outcomeTone(outcome: AuditLogItem['outcome']): 'success' | 'warning' | 'danger' {
  if (outcome === 'SUCCESS') return 'success';
  if (outcome === 'DENIED') return 'warning';
  return 'danger';
}

function outcomeLabel(outcome: AuditLogItem['outcome'], t: (key: TranslationKey) => string) {
  if (outcome === 'SUCCESS') return t('auditOutcomeSuccess');
  if (outcome === 'DENIED') return t('auditOutcomeDenied');
  return t('auditOutcomeFailure');
}

function MetaBlock({ item, t }: { item: AuditLogItem; t: (key: TranslationKey) => string }) {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-surface-2 p-3 text-sm">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('auditMeta')}</p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-surface p-2 font-mono text-xs text-foreground">
          {item.meta && Object.keys(item.meta).length > 0 ? JSON.stringify(item.meta, null, 2) : '—'}
        </pre>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('auditUserAgent')}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{item.userAgent || '—'}</p>
      </div>
    </div>
  );
}

export function AuditTable({ items, language }: { items: AuditLogItem[]; language: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Desktop dense table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-3 py-2.5" aria-hidden="true" />
              <th className="px-3 py-2.5">{t('auditColTime')}</th>
              <th className="px-3 py-2.5">{t('auditColActor')}</th>
              <th className="px-3 py-2.5">{t('auditColAction')}</th>
              <th className="px-3 py-2.5">{t('auditColTarget')}</th>
              <th className="px-3 py-2.5">{t('auditColOutcome')}</th>
              <th className="px-3 py-2.5">{t('auditColIp')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isExpanded = expanded.has(item.id);
              return (
                <Fragment key={item.id}>
                  <tr className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
                    <td className="px-3 py-2.5 align-top">
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`audit-detail-${item.id}`}
                        aria-label={t('auditToggleDetails')}
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={15} />
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top text-foreground">
                      <span title={formatLocalDateTime(item.createdAt, language)}>
                        {formatRelativeTime(item.createdAt, language)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-foreground">{item.actorCin || '—'}</span>
                        {item.actorRole ? (
                          <Badge tone={item.actorRole === 'OFFICIAL' ? 'primary' : 'neutral'}>{item.actorRole}</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-col">
                        <span className="text-foreground">{getActionLabel(item.action, t)}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{item.action}</span>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-3 py-2.5 align-top">
                      <span className="block truncate font-mono text-xs text-muted-foreground" title={item.targetId ?? undefined}>
                        {item.targetType ? `${item.targetType}:` : ''}
                        {item.targetId ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Badge tone={outcomeTone(item.outcome)}>{outcomeLabel(item.outcome, t)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs text-muted-foreground">
                      {item.ip || '—'}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr id={`audit-detail-${item.id}`} className="border-b border-border/60 bg-surface-2/40">
                      <td colSpan={7} className="px-3 py-3">
                        <MetaBlock item={item} t={t} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="grid grid-cols-1 gap-3 sm:hidden">
        {items.map((item) => {
          const isExpanded = expanded.has(item.id);
          return (
            <li key={item.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{getActionLabel(item.action, t)}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{item.action}</p>
                </div>
                <Badge tone={outcomeTone(item.outcome)}>{outcomeLabel(item.outcome, t)}</Badge>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <dt className="text-muted-foreground">{t('auditColTime')}</dt>
                  <dd className="text-foreground" title={formatLocalDateTime(item.createdAt, language)}>
                    {formatRelativeTime(item.createdAt, language)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('auditColActor')}</dt>
                  <dd className="truncate font-mono text-foreground">{item.actorCin || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('auditColTarget')}</dt>
                  <dd className="truncate font-mono text-foreground">{item.targetId || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('auditColIp')}</dt>
                  <dd className="font-mono text-foreground">{item.ip || '—'}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isExpanded}
                aria-controls={`audit-detail-m-${item.id}`}
                className={cn(
                  'mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded'
                )}
              >
                <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={13} />
                {t('auditToggleDetails')}
              </button>
              {isExpanded && (
                <div id={`audit-detail-m-${item.id}`} className="mt-2">
                  <MetaBlock item={item} t={t} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
