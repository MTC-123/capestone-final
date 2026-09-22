'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon } from '@/components/ui/Icon';
import type { Notification, NotificationType } from '@/types';
import { clientLogger } from '@/lib/observability/clientLogger';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useNotificationStore } from '@/store/useNotificationStore';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ isOpen, onClose }: NotificationsPanelProps) {
  const { t } = useTranslation();
  const notifications = useNotificationStore((s) => s.notifications);
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const fetchNotifications = async () => {
      setLoading(true);
      setError(null);
      setErrorRequestId(null);

      try {
        const res = await fetchWithAuth('/api/notifications', { cache: 'no-store' });
        const requestId = res.headers.get('x-request-id');

        if (res.ok) {
          const data = (await res.json()) as { notifications?: Notification[] };
          if (!active) return;
          setNotifications(data.notifications ?? []);
          markAllAsRead();
          setError(null);
        } else {
          const errorData = await res.json().catch(() => ({}));
          if (!active) return;
          const errorMessage = errorData.error?.userMessage || t('errorLoadingNotifications') || 'Failed to load notifications';
          setError(errorMessage);
          setErrorRequestId(errorData.error?.requestId || requestId || null);

          clientLogger.error({
            event: 'notifications_fetch_failed',
            route: '/api/notifications',
            requestId: requestId || undefined,
            meta: {
              status: res.status,
              errorCode: errorData.error?.code,
            },
          });
        }
      } catch (err) {
        if (!active) return;
        setError(t('connectionError') || 'Connection error');

        clientLogger.error({
          event: 'notifications_fetch_exception',
          route: '/api/notifications',
          error: {
            name: (err as Error)?.name,
            message: (err as Error)?.message,
            stack: (err as Error)?.stack,
          },
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchNotifications();

    return () => {
      active = false;
    };
  }, [isOpen, markAllAsRead, setNotifications, t]);

  if (!isOpen) return null;

  const getToneClass = (type?: NotificationType) => {
    switch (type) {
      case 'NEW_REPORT':
        return 'bg-danger';
      case 'STATUS_CHANGE':
        return 'bg-warning';
      case 'WEATHER_ALERT':
        return 'bg-info';
      case 'POI_ACTIVATION':
        return 'bg-primary';
      default:
        return 'bg-success';
    }
  };

  const formatCreatedAt = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden={true}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-panel-title"
        className="fixed inset-x-2 bottom-[calc(var(--mobile-tabbar-height)+0.75rem)] z-50 max-h-[min(76dvh,640px)] rounded-lg border border-border bg-surface shadow-elev-2 sm:bottom-auto sm:left-auto sm:right-4 sm:top-16 sm:w-96 sm:max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="notifications-panel-title" className="text-sm font-bold">{t('notifications')}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-surface-2 transition-colors"
            aria-label={t('closePanel')}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(min(76dvh,640px)-3.25rem)] overflow-y-auto sm:max-h-[70vh]">
          {error ? (
            <div className="p-4">
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-900">{error}</p>
                {errorRequestId && (
                  <p className="text-xs text-red-700 mt-2">
                    Request ID: {errorRequestId}
                  </p>
                )}
              </div>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-3" aria-busy="true" aria-label={t('loading')}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="mt-1 h-3 w-3 flex-shrink-0 rounded-full bg-muted-foreground/10" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <div className="h-4 w-32 rounded-xl bg-muted-foreground/10" />
                      <div className="h-3 w-16 rounded-xl bg-muted-foreground/10" />
                    </div>
                    <div className="h-3 w-full rounded-xl bg-muted-foreground/10" />
                    <div className="h-3 w-20 rounded-xl bg-muted-foreground/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Icon name="notifications" size={48} className="text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm text-muted-foreground">{t('noNotifications')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <a
                  key={notification.id}
                  href={notification.referenceUrl ?? '/reports-list'}
                  className="block px-4 py-3 hover:bg-surface-2 transition-colors"
                  onClick={onClose}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${getToneClass(notification.type)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-bold truncate">
                          {notification.title}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatCreatedAt(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                        {notification.body}
                      </p>
                      {notification.referenceId && (
                        <p className="text-xs font-semibold text-muted-foreground">
                          {notification.referenceId.slice(0, 12)}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
