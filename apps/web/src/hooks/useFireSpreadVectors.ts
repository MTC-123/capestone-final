import { useMemo, useState, useEffect } from 'react';
import { calculateSpread, computeEndpoint } from '@/lib/fire-spread/model';
import {
  nearestGridValue,
  interpolateWind,
  nearestSoilMoisture,
  type RegularGrid,
} from '@/lib/fire-spread/interpolate';
import type {
  GeoFeatureCollection,
  GeoFirmsDetectionProps,
  GeoIncidentProps,
  GeoWindPointProps,
} from '@/types';

// Module-level singleton cache — loaded once, reused across all hook instances
let envGridCache: RegularGrid | null = null;
let envGridPromise: Promise<RegularGrid | null> | null = null;

function loadEnvironmentGrid(): Promise<RegularGrid | null> {
  if (envGridCache) return Promise.resolve(envGridCache);
  if (envGridPromise) return envGridPromise;

  envGridPromise = fetch('/data/ifrane-environment-grid.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data: RegularGrid | null) => {
      if (data) envGridCache = data;
      return data;
    })
    .catch(() => null);

  return envGridPromise;
}

export type FireSpreadStatus = 'idle' | 'loading' | 'no-fires' | 'has-vectors' | 'error';

export interface FireSpreadResult {
  vectors: GeoJSON.FeatureCollection | null;
  status: FireSpreadStatus;
}

/**
 * Produces renderable GeoJSON LineString features representing
 * predicted fire spread directions from active fire sources.
 *
 * Returns a status field so the UI can distinguish between
 * "no active fires" vs "loading" vs "has results".
 */
export function useFireSpreadVectors(
  firmsDetections: GeoFeatureCollection<GeoFirmsDetectionProps>,
  incidents: GeoFeatureCollection<GeoIncidentProps>,
  windData: GeoFeatureCollection<GeoWindPointProps>,
  soilMoistureData: { features?: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, number> }> } | null,
  isActive: boolean,
  simulationPoint: { lon: number; lat: number } | null = null,
): FireSpreadResult {
  const [envGrid, setEnvGrid] = useState<RegularGrid | null>(envGridCache);
  const [gridLoading, setGridLoading] = useState(false);

  // Load environment grid when layer is activated
  useEffect(() => {
    if (!isActive) return;
    if (envGridCache) {
      setEnvGrid(envGridCache);
      return;
    }

    let cancelled = false;
    setGridLoading(true);
    loadEnvironmentGrid().then((grid) => {
      if (!cancelled) {
        if (grid) setEnvGrid(grid);
        setGridLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [isActive]);

  // Collect fire source coordinates
  const firePoints = useMemo(() => {
    if (!isActive) return [];

    const points: Array<{ lon: number; lat: number; id: string; fireType: 'firms' | 'incident' | 'simulation' }> = [];

    // FIRMS detections where isRecent === true
    for (const f of firmsDetections.features) {
      if (f.properties.isRecent && f.geometry.type === 'Point') {
        const coords = f.geometry.coordinates as [number, number];
        points.push({
          lon: coords[0],
          lat: coords[1],
          id: f.properties.id,
          fireType: 'firms',
        });
      }
    }

    // Incidents with status INTERVENTION or ALERTE
    for (const f of incidents.features) {
      const status = f.properties.status;
      if ((status === 'INTERVENTION' || status === 'ALERTE') && f.geometry.type === 'Point') {
        const coords = f.geometry.coordinates as [number, number];
        points.push({
          lon: coords[0],
          lat: coords[1],
          id: f.properties.id,
          fireType: 'incident',
        });
      }
    }

    // Simulation point (user-placed)
    if (simulationPoint) {
      points.push({
        lon: simulationPoint.lon,
        lat: simulationPoint.lat,
        id: 'simulation',
        fireType: 'simulation',
      });
    }

    return points;
  }, [isActive, firmsDetections, incidents, simulationPoint]);

  // Compute spread vectors
  const vectors = useMemo(() => {
    if (!isActive || firePoints.length === 0 || !envGrid) return null;

    const windFeatures = windData.features.map((f) => ({
      geometry: f.geometry as { coordinates: [number, number] },
      properties: { speed: f.properties.speed, direction: f.properties.direction },
    }));

    const soilFeatures = soilMoistureData?.features ?? [];

    const features: GeoJSON.Feature[] = [];

    for (const fire of firePoints) {
      // Interpolate wind at fire point
      const wind = interpolateWind(windFeatures, fire.lon, fire.lat);
      if (!wind) continue;

      // Look up terrain data from environment grid
      const slope = nearestGridValue(envGrid, fire.lon, fire.lat, 'slope') ?? 5;
      const aspect = nearestGridValue(envGrid, fire.lon, fire.lat, 'aspect') ?? 0;
      const fuelType = nearestGridValue(envGrid, fire.lon, fire.lat, 'fuel') ?? 10;

      // Look up soil moisture (nearest neighbor, default 0.3)
      const soilMoisture = nearestSoilMoisture(soilFeatures, fire.lon, fire.lat);

      // Calculate spread
      const spread = calculateSpread({
        windSpeed: wind.speed,
        windDirection: wind.direction,
        slope,
        aspect,
        fuelType,
        soilMoisture,
      });

      // Skip zero-rate spreads (water, etc.)
      if (spread.relativeRate <= 0) continue;

      // Compute endpoint: 0.5–3km arrow
      const arrowLength = 0.5 + spread.relativeRate * 2.5;
      const [endLon, endLat] = computeEndpoint(
        fire.lon,
        fire.lat,
        spread.direction,
        arrowLength,
      );

      // Line feature
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [fire.lon, fire.lat],
            [endLon, endLat],
          ],
        },
        properties: {
          direction: spread.direction,
          relativeRate: spread.relativeRate,
          riskLevel: spread.riskLevel,
          fireId: fire.id,
          fireType: fire.fireType,
        },
      });

      // Separate point feature for the arrowhead tip
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [endLon, endLat],
        },
        properties: {
          direction: spread.direction,
          relativeRate: spread.relativeRate,
          riskLevel: spread.riskLevel,
          fireId: fire.id,
          fireType: fire.fireType,
          isTip: true,
        },
      });
    }

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [isActive, firePoints, envGrid, windData, soilMoistureData]);

  // Derive status
  const status: FireSpreadStatus = useMemo(() => {
    if (!isActive) return 'idle';
    if (gridLoading || (!envGrid && isActive)) return 'loading';
    if (firePoints.length === 0) return 'no-fires';
    if (vectors && vectors.features.length > 0) return 'has-vectors';
    // envGrid loaded, fire points exist, but no vectors computed (e.g. all on water)
    if (firePoints.length > 0 && vectors?.features.length === 0) return 'has-vectors';
    return 'no-fires';
  }, [isActive, gridLoading, envGrid, firePoints, vectors]);

  return { vectors, status };
}
