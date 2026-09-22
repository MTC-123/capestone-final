/**
 * Dispatch layer factories for map visualization - MVP Phase
 * Creates Deck.gl layers for routes and dispatch-related features
 */

import { PathLayer, IconLayer, ArcLayer } from '@deck.gl/layers';
import { circleIcon } from './helpers';
import type { RouteResponse } from '@/lib/routing/types';

export interface RouteLayerData {
  route: RouteResponse;
  routeId: string;
  isPrimary: boolean;
}

export interface ActiveTeamLayerData {
  teamId: string;
  teamName: string;
  status: string;
  coordinates: [number, number];
}

/**
 * Creates PathLayer for dispatch routes.
 * Accepts optional dashOffset (0→1) to animate route alpha for Tier A GPU.
 */
export function createRouteLayer(
  routes: RouteLayerData[],
  isActive: boolean,
  dashOffset?: number
): PathLayer | null {
  if (!isActive || routes.length === 0) return null;

  const data = routes.map((r) => ({
    path: r.route.primary.coordinates,
    routeId: r.routeId,
    isPrimary: r.isPrimary,
    distance_km: r.route.primary.distance_km,
    duration_min: r.route.primary.duration_min,
  }));

  // Subtle pulsing alpha on routes when dashOffset is provided (Tier A animation)
  const phase = dashOffset ?? 0;
  const pulseAlpha = Math.floor(180 + Math.sin(phase * Math.PI * 2) * 60);

  return new PathLayer({
    id: 'dispatch-routes',
    data,
    getPath: (d: (typeof data)[0]) => d.path,
    getColor: (d: (typeof data)[0]) =>
      d.isPrimary ? [37, 99, 235, pulseAlpha] : [249, 115, 22, 180],
    getWidth: (d: (typeof data)[0]) => (d.isPrimary ? 4 : 3),
    widthMinPixels: 2,
    widthMaxPixels: 8,
    pickable: true,
    updateTriggers: {
      getPath: [data.length],
      getColor: [data.length, dashOffset],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onHover: (info: any) => {
      const tooltip = document.getElementById('map-tooltip');
      if (!tooltip) return false;

      if (info.object) {
        const obj = info.object as { distance_km: number; duration_min: number; isPrimary: boolean };
        const routeType = obj.isPrimary ? 'Primary Route' : 'Alternative Route';
        tooltip.innerHTML = `
          <div><strong>${routeType}</strong></div>
          <div>Distance: ${obj.distance_km.toFixed(2)} km</div>
          <div>Duration: ${obj.duration_min.toFixed(0)} min</div>
        `;
        tooltip.style.left = `${info.x}px`;
        tooltip.style.top = `${info.y}px`;
        tooltip.style.display = 'block';
        return true;
      } else {
        tooltip.style.display = 'none';
        return false;
      }
    },
  });
}

/**
 * Creates an ArcLayer showing dispatch arcs from team origin to incident destination.
 * Each arc spans from the first coordinate (team) to the last coordinate (incident) of the route.
 */
export function createDispatchArcLayer(
  routes: RouteLayerData[],
  isActive: boolean
): ArcLayer | null {
  if (!isActive || routes.length === 0) return null;

  const data = routes
    .filter((r) => r.isPrimary && r.route.primary.coordinates.length >= 2)
    .map((r) => {
      const coords = r.route.primary.coordinates;
      return {
        from: coords[0] as [number, number],
        to: coords[coords.length - 1] as [number, number],
        routeId: r.routeId,
        distance_km: r.route.primary.distance_km,
        duration_min: r.route.primary.duration_min,
      };
    });

  if (data.length === 0) return null;

  return new ArcLayer({
    id: 'dispatch-arcs',
    data,
    getSourcePosition: (d: (typeof data)[0]) => d.from,
    getTargetPosition: (d: (typeof data)[0]) => d.to,
    getSourceColor: () => [37, 99, 235, 180] as [number, number, number, number],
    getTargetColor: () => [239, 68, 68, 220] as [number, number, number, number],
    getHeight: 0.3,
    getWidth: 3,
    pickable: true,
    updateTriggers: {
      getSourcePosition: [data.length],
      getTargetPosition: [data.length],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onHover: (info: any) => {
      const tooltip = document.getElementById('map-tooltip');
      if (!tooltip) return false;

      if (info.object) {
        const obj = info.object as { distance_km: number; duration_min: number };
        tooltip.innerHTML = `
          <div><strong>Dispatch Arc</strong></div>
          <div>Distance: ${obj.distance_km.toFixed(2)} km</div>
          <div>ETA: ${obj.duration_min.toFixed(0)} min</div>
        `;
        tooltip.style.left = `${info.x}px`;
        tooltip.style.top = `${info.y}px`;
        tooltip.style.display = 'block';
        return true;
      } else {
        tooltip.style.display = 'none';
        return false;
      }
    },
  });
}

/**
 * Creates IconLayer for active teams (teams currently dispatched)
 * Reuses existing resource layer pattern
 */
export function createActiveTeamsLayer(
  teams: ActiveTeamLayerData[],
  isActive: boolean
): IconLayer | null {
  if (!isActive || teams.length === 0) return null;

  const statusColorMap: Record<string, string> = {
    EN_ROUTE: '#eab308', // Yellow
    ON_SCENE: '#22c55e', // Green
    RETURNING: '#3b82f6', // Blue
    AVAILABLE: '#6b7280', // Gray
    UNAVAILABLE: '#dc2626', // Red
  };

  const data = teams.map((team) => ({
    coordinates: team.coordinates,
    color: statusColorMap[team.status] ?? '#6b7280',
    teamId: team.teamId,
    teamName: team.teamName,
    status: team.status,
  }));

  return new IconLayer({
    id: 'active-teams',
    data,
    getPosition: (d: (typeof data)[0]) => d.coordinates,
    getIcon: (d: (typeof data)[0]) => ({
      url: circleIcon(d.color),
      width: 24,
      height: 24,
    }),
    getSize: () => 36, // Slightly larger than regular resources
    pickable: true,
    updateTriggers: {
      getPosition: [data.length],
      getIcon: [data.length],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onHover: (info: any) => {
      const tooltip = document.getElementById('map-tooltip');
      if (!tooltip) return false;

      if (info.object) {
        const obj = info.object as { teamName: string; status: string };
        const statusLabel = obj.status.replace('_', ' ');
        tooltip.innerHTML = `
          <div><strong>${obj.teamName}</strong></div>
          <div>Status: ${statusLabel}</div>
        `;
        tooltip.style.left = `${info.x}px`;
        tooltip.style.top = `${info.y}px`;
        tooltip.style.display = 'block';
        return true;
      } else {
        tooltip.style.display = 'none';
        return false;
      }
    },
  });
}

// ============================================
// Vehicle Layer
// ============================================

export interface VehicleLayerData {
  vehicleId: string;
  callSign: string;
  type: string;
  status: string;
  coordinates: [number, number];
}

const VEHICLE_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#22c55e',     // Green
  EN_ROUTE: '#eab308',      // Yellow
  ON_SCENE: '#3b82f6',      // Blue
  RETURNING: '#6b7280',     // Gray
  OUT_OF_SERVICE: '#dc2626', // Red
};

/**
 * Creates IconLayer for vehicles
 */
export function createVehicleLayer(
  vehicles: VehicleLayerData[],
  isActive: boolean
): IconLayer | null {
  if (!isActive || vehicles.length === 0) return null;

  const data = vehicles.map((v) => ({
    coordinates: v.coordinates,
    color: VEHICLE_STATUS_COLORS[v.status] ?? '#6b7280',
    vehicleId: v.vehicleId,
    callSign: v.callSign,
    type: v.type,
    status: v.status,
  }));

  return new IconLayer({
    id: 'vehicles',
    data,
    getPosition: (d: (typeof data)[0]) => d.coordinates,
    getIcon: (d: (typeof data)[0]) => ({
      url: circleIcon(d.color),
      width: 24,
      height: 24,
    }),
    getSize: () => 38,
    pickable: true,
    updateTriggers: {
      getPosition: [data.length],
      getIcon: [data.length],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onHover: (info: any) => {
      const tooltip = document.getElementById('map-tooltip');
      if (!tooltip) return false;

      if (info.object) {
        const obj = info.object as { callSign: string; type: string; status: string };
        const typeLabel = obj.type.replace(/_/g, ' ');
        const statusLabel = obj.status.replace(/_/g, ' ');
        tooltip.innerHTML = `
          <div><strong>${obj.callSign}</strong></div>
          <div>${typeLabel}</div>
          <div>Status: ${statusLabel}</div>
        `;
        tooltip.style.left = `${info.x}px`;
        tooltip.style.top = `${info.y}px`;
        tooltip.style.display = 'block';
        return true;
      } else {
        tooltip.style.display = 'none';
        return false;
      }
    },
  });
}

/**
 * Transform vehicle data to vehicle layer format
 */
export function transformVehicleToLayerData(vehicle: {
  id: string;
  callSign: string;
  type: string;
  status: string;
  location: { type: 'Point'; coordinates: [number, number] };
}): VehicleLayerData {
  return {
    vehicleId: vehicle.id,
    callSign: vehicle.callSign,
    type: vehicle.type,
    status: vehicle.status,
    coordinates: vehicle.location.coordinates,
  };
}

/**
 * Transform route response to layer data format
 */
export function transformRouteToLayerData(
  route: RouteResponse,
  routeId: string,
  isPrimary = true
): RouteLayerData {
  return {
    route,
    routeId,
    isPrimary,
  };
}

/**
 * Transform team data to active teams layer format
 */
export function transformTeamToLayerData(team: {
  id: string;
  name: string;
  status: string;
  location: { type: 'Point'; coordinates: [number, number] };
}): ActiveTeamLayerData {
  return {
    teamId: team.id,
    teamName: team.name,
    status: team.status,
    coordinates: team.location.coordinates,
  };
}
