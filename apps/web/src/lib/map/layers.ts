/**
 * Deck.gl layer factory functions for map visualization
 */

import { IconLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { RESOURCE_TYPE_COLORS, INCIDENT_STATUS_COLORS, INFRASTRUCTURE_TYPE_COLORS, RETARDANT_COLOR } from './colors';
import { shapeIcon, hexToRgba, RESOURCE_SHAPE, INFRA_SHAPE } from './helpers';
import type { GeoFeatureCollection, GeoResourceProps, GeoInfrastructureProps, GeoIncidentProps } from '@/types';

/**
 * Creates icon layer for resource markers (trucks, aircraft, personnel, equipment)
 */
export function createResourceLayer(
  resources: GeoFeatureCollection<GeoResourceProps>,
  isActive: boolean,
  activeTypes?: Record<string, boolean>
): IconLayer | null {
  if (!isActive || resources.features.length === 0) return null;

  const filtered = activeTypes
    ? resources.features.filter((f) => activeTypes[f.properties.type] !== false)
    : resources.features;
  if (filtered.length === 0) return null;

  const data = filtered.map((f) => ({
    coordinates: f.geometry.coordinates as [number, number],
    color: RESOURCE_TYPE_COLORS[f.properties.type] ?? '#6b7280',
    type: f.properties.type,
  }));

  return new IconLayer({
    id: 'resource-icons',
    data,
    getPosition: (d: (typeof data)[0]) => d.coordinates,
    getIcon: (d: (typeof data)[0]) => ({
      url: shapeIcon(RESOURCE_SHAPE[d.type] ?? 'circle', d.color),
      width: 24,
      height: 24,
    }),
    getSize: () => 32,
    updateTriggers: {
      getPosition: [data.length],
      getIcon: [data.length],
    },
  });
}

/**
 * Creates an animated ScatterplotLayer that pulses for active incidents.
 * Only rendered on Tier A/B (caller guards with tierConfig.enableAnimations).
 *
 * @param incidents - All incident features
 * @param pulsePhase - Animation phase 0→1 driven by a rAF loop in the map component
 * @param isActive - Whether the incidents layer is toggled on
 */
export function createIncidentPulseLayer(
  incidents: GeoFeatureCollection<GeoIncidentProps>,
  pulsePhase: number,
  isActive: boolean
): ScatterplotLayer | null {
  if (!isActive) return null;

  const activeFeatures = incidents.features.filter(
    (f) => f.properties.status !== 'ETEINT',
  );
  if (activeFeatures.length === 0) return null;

  const data = activeFeatures.map((f) => ({
    coordinates: f.geometry.coordinates as [number, number],
    severity: f.properties.severity ?? 1,
    color: INCIDENT_STATUS_COLORS[f.properties.status] ?? '#6b7280',
  }));

  const sinVal = Math.sin(pulsePhase * Math.PI * 2);

  return new ScatterplotLayer({
    id: 'incident-pulse',
    data,
    getPosition: (d: (typeof data)[0]) => d.coordinates,
    getRadius: (d: (typeof data)[0]) =>
      (d.severity / 5) * (30 + sinVal * 14),
    getFillColor: (d: (typeof data)[0]) =>
      hexToRgba(d.color, Math.floor(60 + sinVal * 40)),
    radiusUnits: 'pixels',
    stroked: false,
    updateTriggers: {
      getRadius: [pulsePhase],
      getFillColor: [pulsePhase],
    },
  });
}

/**
 * Creates icon and path layers for infrastructure (watchtowers, water points, stations, firebreaks, helipads)
 */
export function createInfrastructureLayers(
  infrastructure: GeoFeatureCollection<GeoInfrastructureProps>,
  isActive: boolean,
  activeTypes?: Record<string, boolean>
): (IconLayer | PathLayer)[] {
  if (!isActive || infrastructure.features.length === 0) return [];

  const layers: (IconLayer | PathLayer)[] = [];
  const shown = activeTypes
    ? infrastructure.features.filter((f) => activeTypes[f.properties.type] !== false)
    : infrastructure.features;

  // Point infrastructure (watchtowers, water points, stations, helipads)
  // Firebreaks recorded as a single point (e.g. a surveyed gate) are drawn as markers too.
  const pointTypes = new Set(['WATCHTOWER', 'WATER_POINT', 'STATION', 'HELIPAD', 'FIREBREAK']);
  const pointFeatures = shown.filter((f) => f.geometry.type === 'Point' && pointTypes.has(f.properties.type));

  if (pointFeatures.length > 0) {
    const data = pointFeatures.map((f) => ({
      coordinates: f.geometry.coordinates as [number, number],
      color: INFRASTRUCTURE_TYPE_COLORS[f.properties.type] ?? '#6b7280',
      type: f.properties.type,
    }));

    layers.push(
      new IconLayer({
        id: 'infra-icons',
        data,
        getPosition: (d: (typeof data)[0]) => d.coordinates,
        getIcon: (d: (typeof data)[0]) => ({
          url: shapeIcon(INFRA_SHAPE[d.type] ?? 'circle', d.color),
          width: 24,
          height: 24,
        }),
        getSize: () => 28,
        updateTriggers: {
          getPosition: [data.length],
          getIcon: [data.length],
        },
      })
    );
  }

  // Firebreak paths
  const firebreaks = shown.filter((f) => f.properties.type === 'FIREBREAK' && f.geometry.type === 'LineString');

  if (firebreaks.length > 0) {
    const paths = firebreaks.map((f) => ({
      path: f.geometry.coordinates as [number, number][],
    }));

    layers.push(
      new PathLayer({
        id: 'firebreak-paths',
        data: paths,
        getPath: (d: (typeof paths)[0]) => d.path,
        getColor: () => [139, 92, 246],
        getWidth: () => 4,
      })
    );
  }

  return layers;
}

/**
 * Retardant layer data item
 */
interface RetardantDataItem {
  coordinates: [number, number];
  name: string;
}

/**
 * Creates icon layer for retardant storage locations
 */
export function createRetardantLayer(
  data: RetardantDataItem[],
  isActive: boolean
): IconLayer | null {
  if (!isActive || data.length === 0) return null;

  return new IconLayer({
    id: 'retardant-icons',
    data,
    getPosition: (d: RetardantDataItem) => d.coordinates,
    getIcon: () => ({
      url: shapeIcon('hexagon', RETARDANT_COLOR),
      width: 24,
      height: 24,
    }),
    getSize: () => 28,
    updateTriggers: {
      getPosition: [data.length],
    },
  });
}
