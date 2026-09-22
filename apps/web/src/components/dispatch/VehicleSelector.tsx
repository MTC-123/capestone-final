'use client';

/**
 * VehicleSelector — picks vehicles for dispatch
 * Mirrors TeamSelector pattern
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useDispatchStore } from '@/store/useDispatchStore';
import type { SelectedVehicle } from '@/store/useDispatchStore';

interface VehicleSelectorProps {
  incidentId: string;
}

interface VehicleFromApi {
  id: string;
  callSign: string;
  type: string;
  status: string;
  location: { type: 'Point'; coordinates: [number, number] } | null;
  baseLocation: { type: 'Point'; coordinates: [number, number] } | null;
  capacity: number;
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  FIRE_TRUCK: 'vehicleFireTruck',
  WATER_TANKER: 'vehicleWaterTanker',
  COMMAND: 'vehicleCommand',
  AMBULANCE: 'vehicleAmbulance',
  HELICOPTER: 'vehicleHelicopter',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function VehicleSelector({ incidentId }: VehicleSelectorProps) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<VehicleFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedVehicles, addVehicle, removeVehicle, isVehicleSelected } = useDispatchStore();

  useEffect(() => {
    let cancelled = false;
    async function fetchVehicles() {
      try {
        const res = await fetch('/api/vehicles?status=AVAILABLE');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setVehicles(data);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchVehicles();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="animate-pulse h-20 bg-muted rounded" />;
  }

  if (vehicles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        {t('noVehiclesAvailable' as Parameters<typeof t>[0])}
      </p>
    );
  }

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto" data-testid="vehicle-selector">
      {vehicles.map((v) => {
        const selected = isVehicleSelected(v.id);
        const location = v.location ?? v.baseLocation;
        const typeKey = VEHICLE_TYPE_LABELS[v.type] ?? v.type;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              if (selected) {
                removeVehicle(v.id);
              } else if (location) {
                addVehicle({
                  id: v.id,
                  callSign: v.callSign,
                  type: v.type,
                  status: v.status,
                  location: location as SelectedVehicle['location'],
                  capacity: v.capacity,
                });
              }
            }}
            disabled={!location && !selected}
            className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors border
              ${selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface-2/50 text-foreground hover:border-primary/50'
              }
              ${!location && !selected ? 'opacity-50 cursor-not-allowed' : ''}`}
            data-testid={`vehicle-${v.id}`}
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="font-medium">{v.callSign}</span>
              <span className="text-muted-foreground">
                {t(typeKey as Parameters<typeof t>[0])} • {v.capacity}L
              </span>
            </div>
            {selected && <span className="text-primary font-bold text-sm">✓</span>}
          </button>
        );
      })}
      {selectedVehicles.length > 0 && (
        <p className="text-xs text-muted-foreground pt-1">
          {selectedVehicles.length} {t('vehiclesSelected' as Parameters<typeof t>[0])}
        </p>
      )}
    </div>
  );
}
