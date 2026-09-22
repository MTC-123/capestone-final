import area from '@turf/area';
import centroid from '@turf/centroid';
import bbox from '@turf/bbox';
import { polygon as turfPolygon } from '@turf/helpers';
import type { GeoJSONPolygon } from '@/lib/validation/geojson';

export interface PolygonStats {
  burnAreaHa: number;
  centroid: [number, number]; // [lng, lat]
  boundingBox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

/**
 * Compute burn area (hectares), centroid, and bounding box from a GeoJSON Polygon.
 */
export function computePolygonStats(polygon: GeoJSONPolygon): PolygonStats {
  const feature = turfPolygon(polygon.coordinates);
  const areaM2 = area(feature);
  const burnAreaHa = Math.round((areaM2 / 10_000) * 100) / 100; // 2 decimal places
  const center = centroid(feature);
  const bb = bbox(feature);

  return {
    burnAreaHa,
    centroid: center.geometry.coordinates as [number, number],
    boundingBox: bb as [number, number, number, number],
  };
}
