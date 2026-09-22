'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes
const WARNING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function useAuthRefresh() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const addToast = useToastStore((s) => s.addToast);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function scheduleTimers() {
      // Clear existing
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);

      // Warning at 10 min
      warningTimer.current = setTimeout(() => {
        addToast('sessionExpiringWarning', 'warning');
      }, WARNING_INTERVAL_MS);

      // Refresh at 12 min
      refreshTimer.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/auth/token', { method: 'POST' });
          if (res.ok) {
            scheduleTimers(); // Reset timers on successful refresh
          } else {
            // Clear zustand state then soft-navigate — avoids the hard
            // reload that used to wipe the store during initial signin.
            logout();
            router.replace('/signin');
          }
        } catch {
          logout();
          router.replace('/signin');
        }
      }, REFRESH_INTERVAL_MS);
    }

    scheduleTimers();

    return () => {
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [addToast, logout, router]);
}
