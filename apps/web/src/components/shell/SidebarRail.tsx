'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';
import { prefetch } from '@/lib/api/client';

const PREFETCH_MAP: Record<string, string> = {
  '/analytics': '/api/analytics',
  '/weather': '/api/weather',
  '/equipment': '/api/equipment',
  '/reports-list': '/api/reports',
  '/coordination': '/api/coordination/agencies',
  '/operations': '/api/operations/campaigns',
};

export type RailItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  restricted?: boolean;
};

export type SidebarRailProps = {
  items: RailItem[];
  footerItems?: RailItem[];
  className?: string;
};

export function SidebarRail({ items, footerItems, className }: SidebarRailProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const renderItem = (item: RailItem) => {
    const isActive = pathname === item.href;

    if (item.restricted) {
      return (
        <div
          key={item.href}
          title={t('restricted')}
          aria-disabled="true"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
            'text-muted-foreground/40 cursor-not-allowed'
          )}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/50">
            {item.icon}
          </span>
          <span className="whitespace-nowrap opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
            {item.label}
          </span>
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        aria-current={isActive ? 'page' : undefined}
        onMouseEnter={() => {
          const apiUrl = PREFETCH_MAP[item.href];
          if (apiUrl) prefetch(apiUrl);
        }}
        className={cn(
          'group/item relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        )}
      >
        {/* Active indicator bar */}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary" />
        )}
        <span className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-150',
          isActive ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-muted-foreground group-hover/item:text-foreground'
        )}>
          {item.icon}
        </span>
        <span className="whitespace-nowrap opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      aria-label={t('primaryNavigation')}
      className={cn(
        'group flex w-[72px] shrink-0 flex-col border-r border-border/50 glass overflow-hidden',
        'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:w-60',
        className
      )}
    >
      <div className="flex flex-1 flex-col gap-0.5 p-2.5 pt-4">
        {items.map(renderItem)}
      </div>

      {footerItems?.length ? (
        <div className="border-t border-border/50 p-2.5">
          {footerItems.map(renderItem)}
        </div>
      ) : null}
    </nav>
  );
}
