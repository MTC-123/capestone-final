'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { useTranslation } from '@/hooks/useTranslation';

export type RightDrawerProps = {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
};

export function RightDrawer({
  title,
  open,
  onOpenChange,
  children,
  className,
}: RightDrawerProps) {
  const { t } = useTranslation();
  const titleId = React.useId();
  const contentEndId = React.useId();
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const lastActiveElementRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    lastActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const shouldLockScroll = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)')?.matches;
    const previousOverflow = document.body.style.overflow;
    if (shouldLockScroll) document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
      if (event.key !== 'Tab') return;
      const root = drawerRef.current;
      if (!root) return;

      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));

      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === root) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (shouldLockScroll) document.body.style.overflow = previousOverflow;
      lastActiveElementRef.current?.focus?.();
    };
  }, [open, onOpenChange]);

  return (
    <>
      <div
        data-testid="right-drawer-overlay"
        aria-hidden={true}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onPointerDown={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={drawerRef}
        className={cn(
          'fixed right-0 top-16 z-50 h-[calc(100dvh-var(--topbar-height))] w-full max-w-[95vw] overflow-hidden sm:w-[400px]',
          'max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[min(82dvh,720px)] max-md:max-w-none max-md:rounded-t-xl',
          'glass shadow-elev-3 border-l border-border/40',
          'max-md:border-l-0 max-md:border-t max-md:pb-[env(safe-area-inset-bottom)]',
          'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          open
            ? 'translate-x-0 max-md:translate-y-0'
            : 'translate-x-full max-md:translate-x-0 max-md:translate-y-full',
          className
        )}
      >
        <div className="flex justify-center pt-2 md:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="flex h-14 items-center justify-between border-b border-border/50 bg-surface-2/60 px-4">
          <div id={titleId} className="min-w-0 text-sm font-bold tracking-tight">
            {title}
          </div>
          <IconButton
            label={t('closePanel')}
            className=""
            onClick={() => onOpenChange(false)}
            ref={closeButtonRef}
          >
            <Icon name="close" aria-hidden={true} size={18} />
          </IconButton>
        </div>
        <div className="h-[calc(100%-3.5rem)] overflow-auto">
          <a
            href={`#${contentEndId}`}
            className={cn(
              'sr-only focus:not-sr-only',
              'm-3 inline-flex rounded-lg bg-surface px-3 py-2 text-sm font-bold text-foreground shadow-elev-1',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            )}
          >
            {t('skipToContent')}
          </a>
          {children}
          <div id={contentEndId} />
        </div>
      </div>
    </>
  );
}
