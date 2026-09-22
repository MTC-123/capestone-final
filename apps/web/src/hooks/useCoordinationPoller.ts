'use client';

import { useEffect, useRef } from 'react';
import { useCoordinationStore } from '@/store/useCoordinationStore';
import type { AgencyStatusRecord } from '@/types/coordination';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useCoordinationPoller() {
  const setAgencies = useCoordinationStore((s) => s.setAgencies);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      if (document.visibilityState === 'hidden') return;

      try {
        const res = await fetch('/api/coordination/agencies');
        if (res.ok) {
          const data = (await res.json()) as { agencies: AgencyStatusRecord[] };
          setAgencies(data.agencies ?? []);
        }
      } catch {
        // Silently ignore poll failures
      }
    }

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

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
  }, [setAgencies]);
}
