'use client';

/**
 * DispatchPanel - MVP Phase
 * Main container for dispatch workflow
 * Slides in from right when incident is selected
 */

import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useDispatchStore } from '@/store/useDispatchStore';
import { useMapStore } from '@/store/useMapStore';
import { useToastStore } from '@/store/useToastStore';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TeamSelector } from './TeamSelector';
import { VehicleSelector } from './VehicleSelector';
import { RouteViewer } from './RouteViewer';
import { DispatchSummary } from './DispatchSummary';
import type { RouteResponse } from '@/lib/routing/types';

interface DispatchPanelProps {
  incidentId: string | null;
  onClose: () => void;
}

export function DispatchPanel({ incidentId, onClose }: DispatchPanelProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const {
    isPanelOpen,
    selectedTeams,
    selectedVehicles,
    activeRoutes,
    isGeneratingRoute,
    routeError,
    isAssigning,
    assignmentError,
    setActiveRoutes,
    setIsGeneratingRoute,
    setRouteError,
    setIsAssigning,
    setAssignmentError,
    setSelectedTeamsEnRoute,
    reset,
  } = useDispatchStore();

  const [activeTab, setActiveTab] = useState<'teams' | 'vehicles'>('teams');

  // Use incident data from the map store instead of fetching
  const incidents = useMapStore((s) => s.incidents);
  const incident = useMemo(() => {
    if (!incidentId) return null;
    const feature = incidents.features.find(
      (f) => f.properties.id === incidentId
    );
    if (!feature) return null;
    return {
      id: feature.properties.id,
      location: feature.geometry
        ? { coordinates: feature.geometry.coordinates as [number, number] }
        : undefined,
      severity: feature.properties.severity,
      status: feature.properties.status,
    };
  }, [incidentId, incidents]);

  const hasSelections = selectedTeams.length > 0 || selectedVehicles.length > 0;

  // Generate routes for selected teams and vehicles
  const handleGenerateRoutes = async () => {
    if (!incident || !hasSelections) return;

    setIsGeneratingRoute(true);
    setRouteError(null);

    try {
      const incidentLocation = incident.location?.coordinates;
      if (!incidentLocation) {
        throw new Error('Incident location not available');
      }

      // Calculate routes for each team and vehicle
      const teamRoutePromises = selectedTeams.map(async (team) => {
        const response = await fetch('/api/dispatch/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: team.location.coordinates,
            destination: incidentLocation,
            profile: 'fire_truck',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.userMessage || 'Route calculation failed');
        }

        const route: RouteResponse = await response.json();
        return {
          routeId: `route-${team.id}`,
          teamId: team.id,
          incidentId: incident.id,
          route,
          selected: false,
        };
      });

      const vehicleRoutePromises = selectedVehicles.map(async (vehicle) => {
        const response = await fetch('/api/dispatch/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: vehicle.location.coordinates,
            destination: incidentLocation,
            profile: 'fire_truck',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.userMessage || 'Route calculation failed');
        }

        const route: RouteResponse = await response.json();
        return {
          routeId: `route-v-${vehicle.id}`,
          teamId: vehicle.id, // Re-use teamId field for layer compat
          incidentId: incident.id,
          route,
          selected: false,
        };
      });

      const routes = await Promise.all([...teamRoutePromises, ...vehicleRoutePromises]);
      setActiveRoutes(routes);
    } catch (error: unknown) {
      setRouteError(error instanceof Error ? error.message : t('errorRoutingServiceUnavailable'));
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  // Confirm dispatch assignment
  const handleConfirmDispatch = async () => {
    if (!incident || !hasSelections) return;

    setIsAssigning(true);
    setAssignmentError(null);

    try {
      const body: Record<string, unknown> = { incidentId: incident.id };
      if (selectedTeams.length > 0) body.teamIds = selectedTeams.map((t) => t.id);
      if (selectedVehicles.length > 0) body.vehicleIds = selectedVehicles.map((v) => v.id);

      const response = await fetch('/api/dispatch/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.userMessage || 'Assignment failed');
      }

      // Mark dispatched teams as EN_ROUTE before resetting
      setSelectedTeamsEnRoute();

      // Show success toast
      addToast('Teams dispatched successfully!', 'success');

      // Reset and close
      reset();
      onClose();
    } catch (error: unknown) {
      setAssignmentError(error instanceof Error ? error.message : t('errorServer'));
    } finally {
      setIsAssigning(false);
    }
  };

  // Close handler
  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isPanelOpen || !incidentId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-surface shadow-2xl max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[min(86dvh,760px)] max-md:max-w-none max-md:rounded-t-xl max-md:pb-[env(safe-area-inset-bottom)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-panel-title"
        data-testid="dispatch-panel"
      >
        <div className="flex justify-center pt-2 md:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-muted-foreground/25" />
        </div>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <h2 id="dispatch-panel-title" className="text-lg font-semibold">
            {t('dispatchTeams') || 'Dispatch Teams'}
          </h2>
          <button
            onClick={handleClose}
            className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('closePanel')}
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Incident Info */}
          {incident ? (
            <div className="bg-muted/50 rounded-lg p-3">
              <h3 className="font-medium text-sm mb-1">
                {t('incident')} #{incident.id.slice(-6)}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('severity')}: {incident.severity}/5 • {t('status')}: {incident.status}
              </p>
            </div>
          ) : null}

          {/* Tab bar: Teams / Vehicles */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab('teams')}
              className={`flex-1 text-xs font-medium py-2 border-b-2 transition-colors ${
                activeTab === 'teams'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('selectTeams') || 'Select Teams'}
              {selectedTeams.length > 0 && ` (${selectedTeams.length})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vehicles')}
              className={`flex-1 text-xs font-medium py-2 border-b-2 transition-colors ${
                activeTab === 'vehicles'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('selectVehicles' as Parameters<typeof t>[0]) || 'Select Vehicles'}
              {selectedVehicles.length > 0 && ` (${selectedVehicles.length})`}
            </button>
          </div>

          {/* Team Selector / Vehicle Selector — both mounted, toggle visibility */}
          <div style={{ display: activeTab === 'teams' ? 'block' : 'none' }}>
            <TeamSelector incidentId={incidentId} />
          </div>
          <div style={{ display: activeTab === 'vehicles' ? 'block' : 'none' }}>
            <VehicleSelector incidentId={incidentId} />
          </div>

          {/* Dispatch Summary */}
          {(selectedTeams.length > 0 || selectedVehicles.length > 0) && (
            <DispatchSummary />
          )}

          {/* Route Viewer */}
          {activeRoutes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">
                {t('routes') || 'Routes'}
              </h3>
              <RouteViewer />
            </div>
          )}

          {/* Error Messages */}
          {routeError && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
              <Icon name="warning" className="inline mr-1" />
              {routeError}
            </div>
          )}

          {assignmentError && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
              <Icon name="warning" className="inline mr-1" />
              {assignmentError}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 space-y-2 border-t border-border bg-surface px-4 py-3">
          {activeRoutes.length === 0 ? (
            <Button
              onClick={handleGenerateRoutes}
              disabled={!hasSelections || isGeneratingRoute}
              className="w-full"
              data-testid="generate-route-button"
            >
              {isGeneratingRoute ? (
                <>
                  <Icon name="loading" className="animate-spin mr-2" />
                  {t('generatingRoute') || 'Generating Routes...'}
                </>
              ) : (
                <>
                  <Icon name="route" className="mr-2" />
                  {t('generateRoute') || 'Generate Routes'}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleConfirmDispatch}
              disabled={isAssigning}
              className="w-full bg-primary hover:bg-primary/90"
              data-testid="confirm-dispatch-button"
            >
              {isAssigning ? (
                <>
                  <Icon name="loading" className="animate-spin mr-2" />
                  {t('dispatching') || 'Dispatching...'}
                </>
              ) : (
                <>
                  <Icon name="send" className="mr-2" />
                  {t('confirmDispatch') || 'Confirm Dispatch'}
                </>
              )}
            </Button>
          )}

          <Button
            onClick={handleClose}
            variant="ghost"
            className="w-full"
          >
            {t('cancel') || 'Cancel'}
          </Button>
        </div>
      </div>
    </>
  );
}
