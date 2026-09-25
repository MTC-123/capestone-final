'use client';

import { useEffect } from 'react';
import { useToastStore, type Toast } from '@/store/useToastStore';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTranslation } from '@/hooks/useTranslation';

/* ─── Single toast ─── */

const TOAST_STYLES: Record<Toast['type'], string> = {
  success: 'border-success/25 bg-success-muted text-success-foreground',
  warning: 'border-warning/25 bg-warning-muted text-warning-foreground',
  error: 'border-danger/25 bg-danger-muted text-danger-foreground',
  info: 'border-info/25 bg-info-muted text-info-foreground',
};

const TOAST_ICONS: Record<Toast['type'], IconName> = {
  success: 'check-circle',
  warning: 'warning',
  error: 'close',
  info: 'info',
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const { t } = useTranslation();

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => removeToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex w-full max-w-sm pointer-events-auto items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-elev-2 transition-all ${TOAST_STYLES[toast.type]}`}
    >
      <Icon name={TOAST_ICONS[toast.type]} size={18} className="mt-0.5 shrink-0" />
      <span className="flex-1">
        <bdi>{toast.message}</bdi>
      </span>
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-60 transition-opacity hover:opacity-100 ms-1"
        aria-label={t('dismiss')}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

/* ─── Container (render in layout) ─── */

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--mobile-tabbar-height)+0.75rem)] z-[9999] flex flex-col items-end gap-2 md:bottom-6 md:left-auto md:right-6 md:w-full"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
