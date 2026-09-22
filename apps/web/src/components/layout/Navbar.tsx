'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useTranslation } from '@/hooks/useTranslation';
import LanguageSwitcher from './LanguageSwitcher';
import { NotificationsPanel } from './NotificationsPanel';
import { ThemeToggle } from './ThemeToggle';
import { Footer } from './Footer';
import { AppShell } from '@/components/shell/AppShell';
import { Topbar } from '@/components/shell/Topbar';
import { SidebarRail } from '@/components/shell/SidebarRail';
import { MobileTabBar } from '@/components/shell/MobileTabBar';
import { SkipLink } from '@/components/shell/SkipLink';
import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/Breadcrumb';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { SearchInput } from '@/components/ui/SearchInput';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useNotificationPoller } from '@/hooks/useNotificationPoller';
import { ShortcutsOverlay } from '@/components/ui/ShortcutsOverlay';
import { cn } from '@/lib/cn';

const BREADCRUMB_MAP: Record<string, string> = {
  '/map': 'fireMap',
  '/analytics': 'analytics',
  '/report': 'reportFire',
  '/reports-list': 'reports',
  '/equipment': 'equipment',
  '/fire-database': 'fireDatabase',
  '/coordination': 'coordination',
  '/operations': 'operationsTitle',
  '/weather': 'weatherTitle',
};

export default function Navbar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { t } = useTranslation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { showOverlay, setShowOverlay } = useKeyboardShortcuts();
  useNotificationPoller();

  const breadcrumbItems: BreadcrumbItem[] = [];
  const pageKey = BREADCRUMB_MAP[pathname];
  if (pageKey) {
    breadcrumbItems.push({ label: t('commandCenter' as Parameters<typeof t>[0]), href: '/map' });
    breadcrumbItems.push({ label: t(pageKey as Parameters<typeof t>[0]) });
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      logout();
      router.push('/signin');
    } catch {
      logout();
      router.push('/signin');
    }
  };

  const isOfficial = user?.role === 'OFFICIAL';
  const isMapPage = pathname === '/map';

  const navItems = [
    { href: '/map', label: t('fireMap'), icon: <Icon name="map" aria-hidden={true} size={20} />, restricted: false },
    { href: '/analytics', label: t('analytics'), icon: <Icon name="analytics" aria-hidden={true} size={20} />, restricted: false },
    { href: '/report', label: t('reportFire'), icon: <Icon name="campaign" aria-hidden={true} size={20} />, restricted: false },
    { href: '/reports-list', label: t('reports'), icon: <Icon name="list" aria-hidden={true} size={20} />, restricted: false },
    { href: '/equipment', label: t('equipment'), icon: <Icon name="truck" aria-hidden={true} size={20} />, restricted: !isOfficial },
    { href: '/fire-database', label: t('fireDatabase'), icon: <Icon name="database" aria-hidden={true} size={20} />, restricted: !isOfficial },
    { href: '/coordination', label: t('coordination'), icon: <Icon name="share" aria-hidden={true} size={20} />, restricted: !isOfficial },
    { href: '/operations', label: t('operationsTitle'), icon: <Icon name="layers" aria-hidden={true} size={20} />, restricted: !isOfficial },
  ];

  return (
    <>
      <SkipLink />
      <AppShell
        topbar={
          <Topbar
            left={
              <div className="flex items-center gap-2.5 min-w-0">
                <Link href="/map" className="flex items-center gap-2.5 group shrink-0" aria-label={t('brandTitle')}>
                  <Logo variant="badge" size="md" priority className="rounded-md shadow-elev-1 transition-all duration-200 group-hover:shadow-elev-2 group-hover:scale-[1.02]" />
                  <span className="sr-only">{t('brandTitle')}</span>
                  <div className="hidden sm:block leading-tight min-w-0">
                    <div className="text-sm font-bold tracking-tight truncate">{t('brandTitle')}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{t('brandSubtitle')}</div>
                  </div>
                </Link>

                <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-success/20 bg-success/8 px-2.5 py-1 shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  <span className="text-[11px] font-semibold text-success-foreground">{t('systemOnline')}</span>
                </div>
              </div>
            }
            center={
              <div className="w-full max-w-md">
                <SearchInput
                  label={t('search')}
                  placeholder={t('globalSearchPlaceholder')}
                  name="globalSearch"
                />
              </div>
            }
            right={
              <div className="flex items-center gap-1 sm:gap-1.5">
                <ThemeToggle />
                <div className="hidden sm:block">
                  <LanguageSwitcher />
                </div>

                <IconButton
                  label={unreadCount > 0 ? `${t('notifications')} (${unreadCount})` : t('notifications')}
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                >
                  <span className="relative">
                    <Icon name="notifications" aria-hidden={true} size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </span>
                </IconButton>

                {/* User info — desktop only */}
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2/80 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold leading-tight">{user?.cin}</div>
                    <div className="truncate text-[10px] text-muted-foreground leading-tight">
                      {user?.role === 'OFFICIAL' ? t('official') : t('civilian')}
                      {user?.department ? ` · ${user.department}` : ''}
                    </div>
                  </div>
                  <Badge tone="primary" className="hidden md:inline-flex text-[10px] px-2 py-0.5">
                    {user?.role === 'OFFICIAL' ? t('roleBadgeOps') : t('roleBadgeUser')}
                  </Badge>
                </div>

                <Button variant="ghost" onClick={handleLogout} className="gap-1.5">
                  <Icon name="logout" aria-hidden={true} size={18} />
                  <span className="sr-only sm:not-sr-only text-xs">{t('logout')}</span>
                </Button>
              </div>
            }
          />
        }
        sidebar={<SidebarRail items={navItems} />}
        mainClassName={cn(isMapPage && 'overflow-hidden pb-0')}
      >
        <div className={cn('flex flex-col', isMapPage ? 'h-full min-h-0' : 'min-h-screen')}>
          {breadcrumbItems.length > 0 && (
            <div className="hidden md:block border-b border-border/40 px-6 py-2 bg-surface-2/40">
              <Breadcrumb items={breadcrumbItems} />
            </div>
          )}
          <div className={cn('flex-1', isMapPage && 'min-h-0')}>{children}</div>
          {!isMapPage && <Footer />}
        </div>
      </AppShell>
      <MobileTabBar />

      <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <ShortcutsOverlay open={showOverlay} onClose={() => setShowOverlay(false)} />
    </>
  );
}
