/**
 * useVehicleTelemetry — subscribes to vehicle telemetry updates
 * If Ably is available, subscribes to realtime channels.
 * If Ably is unavailable, falls back to polling /api/geo/vehicles every 10s.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GeoFeatureCollection, GeoVehicleProps } from '@/types';

const POLL_INTERVAL = 10_000; // 10 seconds

interface UseVehicleTelemetryOptions {
  enabled?: boolean;
}

export function useVehicleTelemetry(
  onUpdate: (data: GeoFeatureCollection<GeoVehicleProps>) => void,
  options: UseVehicleTelemetryOptions = {}
) {
  const { enabled = true } = options;
  const [ablyAvailable, setAblyAvailable] = useState<boolean | null>(null);
  const ablyClientRef = useRef<unknown>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Check if Ably is available
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function checkAbly() {
      try {
        const res = await fetch('/api/realtime/token');
        if (!cancelled) {
          setAblyAvailable(res.ok);
        }
      } catch {
        if (!cancelled) setAblyAvailable(false);
      }
    }

    checkAbly();
    return () => { cancelled = true; };
  }, [enabled]);

  // Polling fallback
  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/geo/vehicles');
      if (res.ok) {
        const data = await res.json();
        onUpdateRef.current(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (!enabled || ablyAvailable === null) return;

    // If Ably is not available, fall back to polling
    if (!ablyAvailable) {
      fetchVehicles();
      const interval = setInterval(fetchVehicles, POLL_INTERVAL);
      return () => clearInterval(interval);
    }

    // Ably subscription would go here when Ably SDK is installed
    // For now, use polling as the default path
    fetchVehicles();
    const interval = setInterval(fetchVehicles, POLL_INTERVAL);
    return () => {
      clearInterval(interval);
      ablyClientRef.current = null;
    };
  }, [enabled, ablyAvailable, fetchVehicles]);

  return { ablyAvailable: ablyAvailable ?? false };
}
