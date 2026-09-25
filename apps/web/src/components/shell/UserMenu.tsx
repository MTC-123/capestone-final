'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useDismiss } from '@/hooks/useDismiss';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

export function initials(name?: string, fallback?: string) {
  const source = (name || fallback || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)).toUpperCase();
}

export async function signOut(router: ReturnType<typeof useRouter>, clear: () => void) {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    document.cookie = 'ricer-role=; Path=/; Max-Age=0; SameSite=Lax';
    clear();
    router.replace('/signin');
    router.refresh();
  }
}

export function UserMenu({ align = 'end' }: { align?: 'start' | 'end' }) {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const isOfficial = user?.role === 'OFFICIAL';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('accountMenu')}
        className="flex items-center gap-2 rounded-lg p-1 pe-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            'grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold',
            isOfficial ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-accent-fire-muted text-accent-fire ring-1 ring-accent-fire/25'
          )}
          aria-hidden
        >
          {initials(user?.fullName, user?.cin)}
        </span>
        <span className="hidden min-w-0 text-start leading-tight md:block">
          <span className="block max-w-[10rem] truncate text-[13px] font-medium">{user?.fullName ?? user?.cin}</span>
          <span className="block text-[11px] text-muted-foreground">
            {isOfficial ? t('accountRoleOfficial') : t('accountRoleCivilian')}
          </span>
        </span>
        <Icon name="chevronDown" size={14} className="hidden text-muted-foreground md:block" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-50 mt-2 w-64 animate-scale-in overflow-hidden rounded-xl border border-border bg-surface shadow-elev-3',
            align === 'end' ? 'end-0' : 'start-0'
          )}
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('accountSignedInAs')}</p>
            <p className="mt-1 truncate text-sm font-semibold">{user?.fullName ?? user?.cin}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{user?.cin}</p>
            {user?.department && <p className="mt-1 truncate text-xs text-muted-foreground">{user.department}</p>}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut(router, logout)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger-muted focus-visible:bg-danger-muted focus-visible:outline-none"
          >
            <Icon name="logout" size={16} />
            {t('accountSignOut')}
          </button>
        </div>
      )}
    </div>
  );
}
