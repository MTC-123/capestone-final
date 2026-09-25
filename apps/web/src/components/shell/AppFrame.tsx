'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useNotificationPoller } from '@/hooks/useNotificationPoller';
import { useRealtime } from '@/hooks/useRealtime';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ShortcutsOverlay } from '@/components/ui/ShortcutsOverlay';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { NotificationsPanel } from '@/components/layout/NotificationsPanel';
import { SkipLink } from '@/components/shell/SkipLink';
import { BrandMark } from '@/components/shell/BrandMark';
import { LiveClock } from '@/components/shell/LiveClock';
import { UserMenu } from '@/components/shell/UserMenu';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { MobileTabBar } from '@/components/shell/MobileTabBar';
import { SECTION_LABEL, SECTION_ORDER, currentNavItem, isActive, navFor } from '@/components/shell/nav';
import { SyncStatusPill } from '@/components/offline';
import { registerServiceWorker } from '@/lib/offline/registerServiceWorker';
import { initSyncEngine, resumeAfterAuth } from '@/lib/offline/sync';
import { useIsApplePlatform, useLocalFlag } from '@/lib/client/browserStores';
import { cn } from '@/lib/cn';

const FULL_BLEED = ['/map'];

/**
 * Authenticated application frame. Officials get the ops command shell
 * (navigation rail + dense top bar, map-first); residents get the civic shell
 * (simple header, emergency guidance, report-first). Both share the mobile
 * tab bar, command palette and notification drawer.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { showOverlay, setShowOverlay, paletteOpen, setPaletteOpen } = useKeyboardShortcuts();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const closePalette = useCallback(() => setPaletteOpen(false), [setPaletteOpen]);
  useNotificationPoller();
  useRealtime();

  // Offline engine: start background sync, resume anything that was waiting
  // on a sign-in, and register the service worker for the offline shell.
  useEffect(() => {
    initSyncEngine();
    void resumeAfterAuth();
    void registerServiceWorker();
  }, []);

  const fullBleed = FULL_BLEED.some((p) => isActive(pathname, p));
  const Shell = user?.role === 'OFFICIAL' ? OpsShell : CivicShell;

  return (
    <>
      <SkipLink />
      <Shell
        fullBleed={fullBleed}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenNotifications={() => setNotificationsOpen((v) => !v)}
      >
        {children}
      </Shell>
      <MobileTabBar />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <ShortcutsOverlay open={showOverlay} onClose={() => setShowOverlay(false)} />
    </>
  );
}

type ShellProps = {
  children: React.ReactNode;
  fullBleed: boolean;
  onOpenPalette: () => void;
  onOpenNotifications: () => void;
};

function NotificationsButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const unread = useNotificationStore((s) => s.unreadCount);
  return (
    <IconButton label={unread > 0 ? `${t('notifications')} (${unread})` : t('notifications')} onClick={onClick}>
      <span className="relative">
        <Icon name="notifications" size={19} />
        {unread > 0 && (
          <span className="absolute -end-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-fire px-1 text-[9.5px] font-bold text-on-accent-fire ring-2 ring-background">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </span>
    </IconButton>
  );
}

function PaletteTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  const { t } = useTranslation();
  const isMac = useIsApplePlatform();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-border bg-surface-2/60 px-3 text-sm text-muted-foreground',
        'hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <Icon name="search" size={16} />
      <span className="flex-1 truncate text-start">{t('paletteOpen')}</span>
      <kbd className="hidden rounded border border-border bg-surface px-1.5 font-mono text-[10px] sm:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
}

/* ───────────────────────────── Ops shell ───────────────────────────── */

function OpsShell({ children, fullBleed, onOpenPalette, onOpenNotifications }: ShellProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [collapsed, setCollapsed] = useLocalFlag('ricer-rail-collapsed');
  const toggleRail = () => setCollapsed(!collapsed);

  const items = navFor(user?.role);
  const current = currentNavItem(pathname, user?.role);

  return (
    <div className="min-h-dvh bg-background" data-shell="ops">
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-40 hidden flex-col border-e border-border bg-surface transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[4.5rem]' : 'w-60'
        )}
        aria-label={t('shellOpsLabel')}
      >
        <div className={cn('flex h-[var(--topbar-height)] items-center border-b border-border', collapsed ? 'justify-center px-2' : 'px-4')}>
          <BrandMark href="/map" subtitle={t('shellOpsLabel')} compact={collapsed} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-none">
          {SECTION_ORDER.map((section) => {
            const sectionItems = items.filter((i) => i.section === section && !i.primary);
            if (!sectionItems.length) return null;
            return (
              <div key={section} className="mb-5">
                {!collapsed && (
                  <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                    {t(SECTION_LABEL[section])}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {sectionItems.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href + item.labelKey}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          title={collapsed ? t(item.labelKey) : undefined}
                          className={cn(
                            'relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
                            collapsed && 'justify-center px-0',
                            active
                              ? 'bg-primary/10 text-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          {active && <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-primary" aria-hidden />}
                          <Icon name={item.icon} size={18} className={active ? 'text-primary' : undefined} />
                          {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                          {collapsed && <span className="sr-only">{t(item.labelKey)}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border p-3">
          <Link
            href="/report"
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-lg bg-accent-fire text-sm font-semibold text-on-accent-fire shadow-glow-fire transition hover:brightness-110',
              collapsed && 'px-0'
            )}
          >
            <Icon name="fire" size={17} />
            {!collapsed && t('reportFireCta')}
            {collapsed && <span className="sr-only">{t('reportFireCta')}</span>}
          </Link>
          <button
            type="button"
            onClick={toggleRail}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={collapsed ? t('navExpand') : t('navCollapse')}
          >
            <Icon name="panel" size={15} className="rtl:-scale-x-100" />
            {!collapsed && t('navCollapse')}
          </button>
        </div>
      </aside>

      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200', collapsed ? 'lg:ps-[4.5rem]' : 'lg:ps-60')}>
        <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:px-5">
          <div className="lg:hidden">
            <BrandMark href="/map" compact />
          </div>
          <div className="min-w-0 flex-1 lg:flex-none">
            <p className="hidden text-[11px] text-muted-foreground lg:block">{t('shellProvince')}</p>
            <h1 className="truncate text-[15px] font-semibold leading-tight">{current ? t(current.labelKey) : t('shellOpsLabel')}</h1>
          </div>
          <div className="hidden flex-1 justify-center md:flex">
            <PaletteTrigger onClick={onOpenPalette} />
          </div>
          <div className="flex items-center gap-1">
            <span className="me-2 hidden items-center gap-2 rounded-full border border-success/25 bg-success-muted/60 py-1 pe-2.5 ps-2 lg:flex">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <LiveClock />
            </span>
            <IconButton label={t('paletteOpen')} onClick={onOpenPalette} className="md:hidden">
              <Icon name="search" size={19} />
            </IconButton>
            <SyncStatusPill className="me-1 hidden whitespace-nowrap sm:inline-flex" />
            <div className="hidden xl:block">
              <LanguageSwitcher size="sm" />
            </div>
            <ThemeToggle />
            <NotificationsButton onClick={onOpenNotifications} />
            <div className="ms-1 hidden sm:block">
              <UserMenu />
            </div>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className={cn(
            'focus:outline-none',
            // Full-bleed pages need a definite height (not flex-1) so the
            // map's percentage height resolves.
            fullBleed
              ? 'h-[calc(100dvh-var(--topbar-height))] flex-none overflow-hidden pb-[var(--mobile-tabbar-height)] lg:pb-0'
              : 'flex-1 pb-[calc(var(--mobile-tabbar-height)+1.5rem)] lg:pb-10'
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/* ──────────────────────────── Civic shell ──────────────────────────── */

function CivicShell({ children, fullBleed, onOpenPalette, onOpenNotifications }: ShellProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const items = navFor(user?.role).filter((i) => !i.primary);

  return (
    <div className="flex min-h-dvh flex-col bg-background" data-shell="civic">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <BrandMark href="/report" subtitle={t('shellCivicLabel')} className="shrink-0" />
          <nav className="ms-2 hidden items-center gap-0.5 lg:flex" aria-label={t('shellCivicLabel')}>
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href + item.labelKey}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {t(item.shortKey ?? item.labelKey)}
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <IconButton label={t('paletteOpen')} onClick={onOpenPalette} className="hidden md:inline-flex">
              <Icon name="search" size={18} />
            </IconButton>
            <div className="hidden xl:block">
              <LanguageSwitcher size="sm" />
            </div>
            <ThemeToggle />
            <NotificationsButton onClick={onOpenNotifications} />
            <Link
              href="/report"
              className="ms-2 hidden h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-accent-fire px-4 text-sm font-semibold text-on-accent-fire shadow-glow-fire transition hover:brightness-110 md:flex"
            >
              <Icon name="fire" size={17} />
              {t('reportFireCta')}
            </Link>
            <div className="ms-1 hidden sm:block">
              <UserMenu />
            </div>
          </div>
        </div>
        <div className="border-t border-danger/15 bg-danger-muted/70">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5 text-[12.5px] text-danger-foreground sm:px-6">
            <Icon name="phone" size={14} />
            <p className="flex-1 truncate">{t('emergencyStrip')}</p>
            <a href="tel:15" className="shrink-0 rounded-md bg-danger px-2.5 py-0.5 text-xs font-semibold text-on-danger hover:brightness-110">
              {t('emergencyCallShort')}
            </a>
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'focus:outline-none',
          fullBleed
            ? 'h-[calc(100dvh-6.25rem)] flex-none overflow-hidden pb-[var(--mobile-tabbar-height)] lg:pb-0'
            : 'flex-1 pb-[calc(var(--mobile-tabbar-height)+1.5rem)] lg:pb-12'
        )}
      >
        {children}
      </main>
    </div>
  );
}
