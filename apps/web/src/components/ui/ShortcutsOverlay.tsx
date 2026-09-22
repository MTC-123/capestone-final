'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon } from '@/components/ui/Icon';

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'F', translationKey: 'shortcutFullscreen' },
  { key: 'R', translationKey: 'shortcutRefresh' },
  { key: 'N', translationKey: 'shortcutNewReport' },
  { key: 'L', translationKey: 'shortcutToggleLayers' },
  { key: 'G', translationKey: 'shortcutToggleLegend' },
  { key: 'W', translationKey: 'shortcutToggleWeather' },
  { key: 'D', translationKey: 'shortcutToggleTheme' },
  { key: 'Esc', translationKey: 'shortcutClosePanel' },
  { key: '?', translationKey: 'shortcutShowHelp' },
] as const;

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('keyboardShortcuts')}
        tabIndex={-1}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/60 bg-surface p-6 shadow-elev-3 animate-scale-in"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{t('keyboardShortcuts')}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted transition-colors"
            aria-label={t('closePanel')}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {SHORTCUTS.map(({ key, translationKey }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {t(translationKey as Parameters<typeof t>[0])}
              </span>
              <kbd className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border border-border bg-muted px-2 text-xs font-mono font-semibold text-muted-foreground">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
