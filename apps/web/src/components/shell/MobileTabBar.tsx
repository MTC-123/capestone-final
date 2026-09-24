'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/useAuthStore';
import { useDismiss } from '@/hooks/useDismiss';
import { Icon } from '@/components/ui/Icon';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { navFor, isActive, type NavItem } from '@/components/shell/nav';
import { signOut } from '@/components/shell/UserMenu';

/**
 * Bottom navigation for phones and small tablets: four destinations, a
 * raised "report a fire" action in the centre, and a sheet for the rest.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMoreOpen(false), []);
  useDismiss(sheetRef, moreOpen, close);
  // Close the sheet when the route changes (state adjustment during render).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMoreOpen(false);
  }

  const items = navFor(user?.role);
  const report = items.find((i) => i.primary);
  const tabs = items.filter((i) => !i.primary).slice(0, 3);
  const rest = items.filter((i) => !i.primary && !tabs.includes(i));
  const moreActive = rest.some((i) => isActive(pathname, i.href));

  const tab = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href + item.labelKey}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[10.5px] font-medium',
          active ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        <Icon name={item.icon} size={21} strokeWidth={active ? 2.3 : 1.9} />
        <span className="max-w-full truncate px-1">{t(item.shortKey ?? item.labelKey)}</span>
      </Link>
    );
  };

  return (
    <>
      {moreOpen && <div className="fixed inset-0 z-40 bg-background/50 backdrop-blur-[2px] lg:hidden" aria-hidden />}
      {moreOpen && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-label={t('navMore')}
          className="fixed inset-x-2 bottom-[calc(var(--mobile-tabbar-height)+0.5rem)] z-50 animate-slide-up-fade rounded-2xl border border-border bg-surface p-2 shadow-elev-3 lg:hidden"
        >
          <div className="grid grid-cols-3 gap-1">
            {rest.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href + item.labelKey}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center text-[11px] font-medium',
                    active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <Icon name={item.icon} size={20} />
                  <span className="line-clamp-2">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border px-1 pt-2">
            <LanguageSwitcher size="sm" />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => signOut(router, logout)}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-danger hover:bg-danger-muted"
              >
                <Icon name="logout" size={16} />
                {t('accountSignOut')}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label={t('navMore')}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex h-[var(--mobile-tabbar-base-height)] max-w-lg items-stretch px-2">
          {tabs.slice(0, 2).map(tab)}
          {report && (
            <div className="flex flex-1 items-start justify-center">
              <Link
                href={report.href}
                aria-label={t(report.labelKey)}
                aria-current={isActive(pathname, report.href) ? 'page' : undefined}
                className="-mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent-fire text-white shadow-glow-fire ring-4 ring-background transition-transform active:scale-95"
              >
                <Icon name="fire" size={24} strokeWidth={2.2} />
              </Link>
            </div>
          )}
          {tabs.slice(2).map(tab)}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[10.5px] font-medium',
              moreOpen || moreActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon name="menu" size={21} />
            <span>{t('navMore')}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
