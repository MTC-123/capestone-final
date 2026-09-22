'use client';

import { useEffect, useRef } from 'react';
import { useNotificationStore } from '@/store/useNotificationStore';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { Notification } from '@/types';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useNotificationPoller() {
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      // Skip if tab is hidden
      if (document.visibilityState === 'hidden') return;

      try {
        const res = await fetchWithAuth('/api/notifications', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { notifications: Notification[] };
          setNotifications(data.notifications ?? []);
        }
      } catch {
        // Silently ignore poll failures
      }
    }

    // Initial fetch
    poll();

    // Set up interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // Re-poll when tab becomes visible
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        poll();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [setNotifications]);
}
