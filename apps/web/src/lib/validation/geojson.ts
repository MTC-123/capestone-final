export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon;

// Validates coordinates are [lng, lat] within valid bounds
function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    !Number.isNaN(value[0]) &&
    !Number.isNaN(value[1]) &&
    value[0] >= -180 && value[0] <= 180 && // longitude
    value[1] >= -90 && value[1] <= 90      // latitude
  );
}

export function isGeoJSONPoint(value: unknown): value is GeoJSONPoint {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return obj.type === 'Point' && isCoordinate(obj.coordinates);
}

export function isGeoJSONLineString(value: unknown): value is GeoJSONLineString {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (obj.type !== 'LineString' || !Array.isArray(obj.coordinates)) return false;
  return obj.coordinates.length >= 2 && obj.coordinates.every(isCoordinate);
}

export function isGeoJSONPolygon(value: unknown): value is GeoJSONPolygon {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (obj.type !== 'Polygon' || !Array.isArray(obj.coordinates)) return false;
  return obj.coordinates.every(
    (ring) => Array.isArray(ring) && ring.length >= 4 && ring.every(isCoordinate)
  );
}

export function validatePoint(value: unknown): GeoJSONPoint | null {
  return isGeoJSONPoint(value) ? value : null;
}

export function validateGeometry(value: unknown): GeoJSONGeometry | null {
  return isGeoJSONPoint(value) || isGeoJSONLineString(value) || isGeoJSONPolygon(value)
    ? value as GeoJSONGeometry
    : null;
}
