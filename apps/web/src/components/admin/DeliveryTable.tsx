'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { maskRecipient, formatLocalDateTime, formatRelativeTime } from '@/components/admin/formatters';

export type NotificationDeliveryItem = {
  id: string;
  event: string;
  channel: 'IN_APP' | 'EMAIL' | 'WHATSAPP';
  recipient: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';
  adapter: string;
  attempts: number;
  lastError?: string | null;
  createdAt: string;
};

const CHANNEL_ICON: Record<NotificationDeliveryItem['channel'], IconName> = {
  IN_APP: 'notifications',
  EMAIL: 'message',
  WHATSAPP: 'phone',
};

function statusTone(status: NotificationDeliveryItem['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'SENT') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'QUEUED') return 'warning';
  return 'neutral';
}

export function DeliveryTable({ items, language }: { items: NotificationDeliveryItem[]; language: string }) {
  const { t } = useTranslation();

  const statusLabel = (status: NotificationDeliveryItem['status']) => {
    if (status === 'SENT') return t('deliveryStatusSent');
    if (status === 'FAILED') return t('deliveryStatusFailed');
    if (status === 'QUEUED') return t('deliveryStatusQueued');
    return t('deliveryStatusSkipped');
  };

  const channelLabel = (channel: NotificationDeliveryItem['channel']) => {
    if (channel === 'EMAIL') return t('channelEmail');
    if (channel === 'WHATSAPP') return t('channelWhatsapp');
    return t('channelInApp');
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
          <Icon name="notifications" size={24} />
        </span>
        <h3 className="mt-4 text-base font-semibold tracking-tight">{t('deliveryEmptyTitle')}</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{t('deliveryEmptyBody')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5">{t('deliveryColChannel')}</th>
              <th className="px-3 py-2.5">{t('deliveryColRecipient')}</th>
              <th className="px-3 py-2.5">{t('deliveryColEvent')}</th>
              <th className="px-3 py-2.5">{t('deliveryColStatus')}</th>
              <th className="px-3 py-2.5">{t('deliveryColAttempts')}</th>
              <th className="px-3 py-2.5">{t('deliveryColLastError')}</th>
              <th className="px-3 py-2.5">{t('auditColTime')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
                <td className="px-3 py-2.5 align-top">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <Icon name={CHANNEL_ICON[item.channel]} size={15} className="text-muted-foreground" />
                    {channelLabel(item.channel)}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top font-mono text-xs text-foreground">{maskRecipient(item.recipient)}</td>
                <td className="px-3 py-2.5 align-top text-foreground">{item.event}</td>
                <td className="px-3 py-2.5 align-top">
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                </td>
                <td className="px-3 py-2.5 align-top tabular text-foreground">{item.attempts}</td>
                <td className="max-w-[220px] px-3 py-2.5 align-top">
                  <span className="block truncate text-xs text-muted-foreground" title={item.lastError ?? undefined}>
                    {item.lastError || '—'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 align-top text-foreground" title={formatLocalDateTime(item.createdAt, language)}>
                  {formatRelativeTime(item.createdAt, language)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="grid grid-cols-1 gap-3 sm:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Icon name={CHANNEL_ICON[item.channel]} size={15} className="text-muted-foreground" />
                {channelLabel(item.channel)}
              </span>
              <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
            </div>
            <p className="mt-1.5 font-mono text-xs text-muted-foreground">{maskRecipient(item.recipient)}</p>
            <p className="mt-1 text-sm text-foreground">{item.event}</p>
            {item.lastError && <p className="mt-1 text-xs text-danger">{item.lastError}</p>}
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t('deliveryColAttempts')}: <span className="tabular">{item.attempts}</span>
              </span>
              <span title={formatLocalDateTime(item.createdAt, language)}>{formatRelativeTime(item.createdAt, language)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
