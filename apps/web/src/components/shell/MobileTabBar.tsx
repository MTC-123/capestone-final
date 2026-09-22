'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/useAuthStore';
import { Icon, type IconName } from '@/components/ui/Icon';

interface TabItem {
  href: string;
  label: string;
  icon: IconName;
  officialOnly?: boolean;
}

const MAIN_TABS: TabItem[] = [
  { href: '/map', label: 'fireMap', icon: 'map' },
  { href: '/analytics', label: 'analytics', icon: 'analytics' },
  { href: '/report', label: 'reportFire', icon: 'campaign' },
];

const MORE_ITEMS: TabItem[] = [
  { href: '/reports-list', label: 'reports', icon: 'list' },
  { href: '/equipment', label: 'equipment', icon: 'truck', officialOnly: true },
  { href: '/fire-database', label: 'fireDatabase', icon: 'database', officialOnly: true },
  { href: '/weather', label: 'weatherTitle', icon: 'thermostat' },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isOfficial = user?.role === 'OFFICIAL';

  const isMoreActive = MORE_ITEMS.some((item) => pathname === item.href);

  return (
    <>
      {/* More flyout */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-[calc(var(--mobile-tabbar-height)+0.5rem)] left-2 right-2 z-50 rounded-xl border border-border/60 bg-surface/95 p-1.5 shadow-elev-3 backdrop-blur-xl animate-slide-up-fade"
          >
            {MORE_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const isRestricted = item.officialOnly && !isOfficial;

              if (isRestricted) {
                return (
                  <div
                    key={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground/40 cursor-not-allowed min-h-[44px]"
                    title={t('restricted')}
                    aria-disabled="true"
                  >
                    <Icon name={item.icon} size={20} aria-hidden />
                    {t(item.label as Parameters<typeof t>[0])}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted/60 active:bg-muted'
                  )}
                >
                  <span className={cn(
                    'grid h-8 w-8 place-items-center rounded-md',
                    isActive ? 'bg-primary/15 text-primary' : 'bg-surface-2'
                  )}>
                    <Icon name={item.icon} size={18} aria-hidden />
                  </span>
                  {t(item.label as Parameters<typeof t>[0])}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Tab bar */}
      <nav
        aria-label={t('primaryNavigation')}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40 flex h-[var(--mobile-tabbar-height)] items-start',
          'border-t border-border/40 glass md:hidden'
        )}
      >
        {MAIN_TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex min-h-[var(--mobile-tabbar-base-height)] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-primary" />
              )}
              <Icon name={tab.icon} size={21} aria-hidden />
              <span>{t(tab.label as Parameters<typeof t>[0])}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            'relative flex min-h-[var(--mobile-tabbar-base-height)] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors',
            isMoreActive || moreOpen ? 'text-primary' : 'text-muted-foreground active:text-foreground'
          )}
        >
          {(isMoreActive && !moreOpen) && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-primary" />
          )}
          <Icon name="more_horiz" size={21} aria-hidden />
          <span>{t('mobileMore' as Parameters<typeof t>[0])}</span>
        </button>
      </nav>
    </>
  );
}
