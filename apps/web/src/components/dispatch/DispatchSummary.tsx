'use client';

/**
 * DispatchSummary - MVP Phase
 * Shows summary of selected teams and dispatch status
 * Displays team count, personnel capacity, and quick stats
 */

import { useTranslation } from '@/hooks/useTranslation';
import { useDispatchStore } from '@/store/useDispatchStore';
import { Icon } from '@/components/ui/Icon';

export function DispatchSummary() {
  const { t } = useTranslation();
  const { selectedTeams, selectedVehicles, activeRoutes } = useDispatchStore();

  if (selectedTeams.length === 0 && selectedVehicles.length === 0) {
    return null;
  }

  // Calculate total personnel capacity
  const totalCapacity = selectedTeams.reduce((sum, team) => sum + team.capacity, 0);
  const totalVehicleCapacity = selectedVehicles.reduce((sum, v) => sum + v.capacity, 0);

  // Calculate total distance and duration if routes exist
  const hasRoutes = activeRoutes.length > 0;
  const totalDistance = hasRoutes
    ? activeRoutes.reduce((sum, r) => sum + r.route.primary.distance_km, 0)
    : 0;
  const avgDuration = hasRoutes
    ? activeRoutes.reduce((sum, r) => sum + r.route.primary.duration_min, 0) / activeRoutes.length
    : 0;

  // Count teams by type
  const teamsByType = selectedTeams.reduce((acc, team) => {
    acc[team.type] = (acc[team.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const teamTypeLabels: Record<string, string> = {
    GROUND_CREW: t('groundCrew') || 'Ground Crew',
    AERIAL_SUPPORT: t('aerialSupport') || 'Aerial',
    COMMAND_UNIT: t('commandUnit') || 'Command',
    MEDICAL: t('medical') || 'Medical',
  };

  const teamTypeIcons: Record<string, string> = {
    GROUND_CREW: 'truck',
    AERIAL_SUPPORT: 'aircraft',
    COMMAND_UNIT: 'command',
    MEDICAL: 'medical',
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">
          {t('dispatchSummary') || 'Dispatch Summary'}
        </h3>
        <span className="text-xs text-muted-foreground">
          {selectedTeams.length > 0 && `${selectedTeams.length} ${t('teams') || 'teams'}`}
          {selectedTeams.length > 0 && selectedVehicles.length > 0 && ' + '}
          {selectedVehicles.length > 0 && `${selectedVehicles.length} ${t('vehicles' as Parameters<typeof t>[0]) || 'vehicles'}`}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Personnel */}
        <div className="bg-surface rounded p-2">
          <div className="text-xs text-muted-foreground mb-1">
            {t('personnel') || 'Personnel'}
          </div>
          <div className="text-lg font-semibold">{totalCapacity}</div>
        </div>

        {/* Team Count */}
        {selectedTeams.length > 0 && (
          <div className="bg-surface rounded p-2">
            <div className="text-xs text-muted-foreground mb-1">
              {t('teams') || 'Teams'}
            </div>
            <div className="text-lg font-semibold">{selectedTeams.length}/5</div>
          </div>
        )}

        {/* Vehicle Count */}
        {selectedVehicles.length > 0 && (
          <div className="bg-surface rounded p-2">
            <div className="text-xs text-muted-foreground mb-1">
              {t('vehicles' as Parameters<typeof t>[0]) || 'Vehicles'}
            </div>
            <div className="text-lg font-semibold">{selectedVehicles.length}/5</div>
          </div>
        )}

        {/* Vehicle Capacity */}
        {selectedVehicles.length > 0 && (
          <div className="bg-surface rounded p-2">
            <div className="text-xs text-muted-foreground mb-1">
              {t('vehicleCapacity' as Parameters<typeof t>[0]) || 'Vehicle Cap.'}
            </div>
            <div className="text-lg font-semibold">{totalVehicleCapacity.toLocaleString()} L</div>
          </div>
        )}

        {/* Total Distance (if routes calculated) */}
        {hasRoutes && (
          <>
            <div className="bg-surface rounded p-2">
              <div className="text-xs text-muted-foreground mb-1">
                {t('totalDistance') || 'Total Distance'}
              </div>
              <div className="text-lg font-semibold">
                {totalDistance.toFixed(1)} km
              </div>
            </div>

            {/* Average Duration */}
            <div className="bg-surface rounded p-2">
              <div className="text-xs text-muted-foreground mb-1">
                {t('avgETA') || 'Avg. ETA'}
              </div>
              <div className="text-lg font-semibold">
                {Math.round(avgDuration)} {t('min') || 'min'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Team Breakdown by Type */}
      {Object.keys(teamsByType).length > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">
            {t('teamComposition') || 'Team Composition'}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(teamsByType).map(([type, count]) => (
              <div
                key={type}
                className="inline-flex items-center gap-1.5 bg-surface rounded-full px-2 py-1 text-xs"
              >
                <Icon name={(teamTypeIcons[type] || 'truck') as import('@/components/ui/Icon').IconName} className="w-3 h-3" />
                <span>{teamTypeLabels[type]}</span>
                <span className="font-semibold">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Message */}
      {!hasRoutes && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <Icon name="info" className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>
              {t('clickGenerateRoutes') || 'Click "Generate Routes" to calculate optimal paths for each team.'}
            </span>
          </p>
        </div>
      )}

      {hasRoutes && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-green-600 flex items-start gap-1">
            <Icon name="check" className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>
              {t('routesReady') || 'Routes calculated. Review routes and confirm dispatch.'}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
