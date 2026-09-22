'use client';

/**
 * RouteViewer - MVP Phase
 * Displays calculated routes with details (distance, duration, ETA)
 * Allows route selection for map highlighting
 */

import { useTranslation } from '@/hooks/useTranslation';
import { useDispatchStore } from '@/store/useDispatchStore';
import { Icon } from '@/components/ui/Icon';

export function RouteViewer() {
  const { t } = useTranslation();
  const { activeRoutes, selectedTeams, selectedVehicles, selectRoute } = useDispatchStore();

  if (activeRoutes.length === 0) {
    return null;
  }

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)} ${t('min') || 'min'}`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}${t('min') || 'min'}`;
  };

  const formatETA = (durationMin: number): string => {
    const now = new Date();
    const eta = new Date(now.getTime() + durationMin * 60 * 1000);
    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-2">
      {activeRoutes.map((routeData) => {
        const team = selectedTeams.find((t) => t.id === routeData.teamId);
        const vehicle = selectedVehicles.find((v) => v.id === routeData.teamId);
        const entity = team || vehicle;
        if (!entity) return null;

        const displayName = team ? team.name : (vehicle ? vehicle.callSign : '');
        const route = routeData.route.primary;
        const isSelected = routeData.selected;

        return (
          <button
            key={routeData.routeId}
            data-testid="route-card"
            onClick={() => selectRoute(routeData.routeId)}
            className={`
              w-full text-left p-3 rounded-lg border transition-all
              ${isSelected ? 'bg-primary/10 border-primary ring-2 ring-primary/20' : 'bg-muted/50 border-border hover:bg-muted'}
            `}
          >
            {/* Team/Vehicle Name */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{displayName}</span>
              {isSelected && (
                <span className="text-xs text-primary">
                  {t('selected') || 'Selected'}
                </span>
              )}
            </div>

            {/* Route Stats */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {/* Distance */}
              <div>
                <div className="text-muted-foreground mb-1">
                  {t('distance') || 'Distance'}
                </div>
                <div className="font-medium">
                  {route.distance_km.toFixed(1)} km
                </div>
              </div>

              {/* Duration */}
              <div>
                <div className="text-muted-foreground mb-1">
                  {t('duration') || 'Duration'}
                </div>
                <div className="font-medium">
                  {formatDuration(route.duration_min)}
                </div>
              </div>

              {/* ETA */}
              <div>
                <div className="text-muted-foreground mb-1">
                  {t('eta') || 'ETA'}
                </div>
                <div className="font-medium">
                  {formatETA(route.duration_min)}
                </div>
              </div>
            </div>

            {/* Route Provider */}
            {routeData.route.metadata.cached && (
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <Icon name="cached" className="w-3 h-3" />
                <span>
                  {t('cached') || 'Cached'} • {routeData.route.metadata.cache_age_seconds}s {t('ago') || 'ago'}
                </span>
              </div>
            )}
          </button>
        );
      })}

      {/* Route Legend */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-0.5 bg-primary"></div>
            <span>{t('routeOnMap') || 'Route displayed on map'}</span>
          </div>
          <p className="mt-1">
            {t('clickRouteToHighlight') || 'Click a route to highlight it on the map'}
          </p>
        </div>
      </div>
    </div>
  );
}
