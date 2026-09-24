'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { refreshSession } from '@/lib/api/fetchWithAuth';

/** Access tokens live 15 minutes; renew a little before they expire. */
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

/**
 * Keeps the session alive silently while the app is open, and renews it
 * immediately when a backgrounded tab becomes visible again (timers do not
 * run reliably while a laptop sleeps). Uses the shared, de-duplicated
 * refresh so it never races fetchWithAuth.
 */
export function useAuthRefresh() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    let lastRefresh = Date.now();

    const renew = async () => {
      lastRefresh = Date.now();
      const ok = await refreshSession();
      if (!ok) {
        logout();
        router.replace(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
      }
    };

    const interval = window.setInterval(renew, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh > REFRESH_INTERVAL_MS) void renew();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [logout, router]);
}
