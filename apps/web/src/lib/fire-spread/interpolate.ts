/**
 * Grid interpolation utilities for looking up environmental values
 * at arbitrary lat/lon positions.
 */

export interface GridBBox {
  lonMin: number;
  latMin: number;
  lonMax: number;
  latMax: number;
  cols: number;
  rows: number;
}

export interface RegularGridFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, number>;
}

export interface RegularGrid {
  features: RegularGridFeature[];
  bbox: GridBBox;
  gridStep: number;
}

/**
 * O(1) nearest-neighbor lookup for a regular grid.
 * Returns null if coordinates are outside the grid.
 */
export function nearestGridValue(
  grid: RegularGrid,
  lon: number,
  lat: number,
  property: string,
): number | null {
  const { bbox, gridStep } = grid;
  if (
    lon < bbox.lonMin || lon > bbox.lonMax ||
    lat < bbox.latMin || lat > bbox.latMax
  ) {
    return null;
  }

  const col = Math.round((lon - bbox.lonMin) / gridStep);
  const row = Math.round((lat - bbox.latMin) / gridStep);

  if (col < 0 || col >= bbox.cols || row < 0 || row >= bbox.rows) {
    return null;
  }

  const idx = row * bbox.cols + col;
  const feature = grid.features[idx];
  if (!feature) return null;

  return feature.properties[property] ?? null;
}

interface WindFeature {
  geometry: { coordinates: [number, number] };
  properties: { speed: number; direction: number };
}

/**
 * Inverse-distance-weighted interpolation of wind data.
 * Uses circular mean for direction interpolation.
 * Falls back to nearest point if fewer than 2 points are available.
 */
export function interpolateWind(
  windFeatures: WindFeature[],
  lon: number,
  lat: number,
): { speed: number; direction: number } | null {
  if (windFeatures.length === 0) return null;

  // Compute distances to all wind grid points
  const withDist = windFeatures.map((f) => {
    const dx = f.geometry.coordinates[0] - lon;
    const dy = f.geometry.coordinates[1] - lat;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return { feature: f, dist };
  });

  // Sort by distance and take 4 nearest
  withDist.sort((a, b) => a.dist - b.dist);
  const nearest = withDist.slice(0, 4);

  // If closest point is essentially at the query point, return it directly
  if (nearest[0].dist < 0.0001) {
    return {
      speed: nearest[0].feature.properties.speed,
      direction: nearest[0].feature.properties.direction,
    };
  }

  // IDW interpolation
  let totalWeight = 0;
  let speedSum = 0;
  let sinSum = 0;
  let cosSum = 0;

  for (const { feature, dist } of nearest) {
    const w = 1 / (dist * dist);
    totalWeight += w;
    speedSum += w * feature.properties.speed;

    // Circular interpolation for direction
    const dirRad = (feature.properties.direction * Math.PI) / 180;
    sinSum += w * Math.sin(dirRad);
    cosSum += w * Math.cos(dirRad);
  }

  const speed = speedSum / totalWeight;
  let direction = (Math.atan2(sinSum / totalWeight, cosSum / totalWeight) * 180) / Math.PI;
  if (direction < 0) direction += 360;

  return { speed, direction };
}

/**
 * Nearest-neighbor lookup for soil moisture data.
 * Returns default value (0.3) if no data is available.
 */
export function nearestSoilMoisture(
  features: Array<{
    geometry: { coordinates: [number, number] };
    properties: { moisture?: number; soil_moisture_0_to_1?: number };
  }>,
  lon: number,
  lat: number,
): number {
  if (features.length === 0) return 0.3;

  let minDist = Infinity;
  let value = 0.3;

  for (const f of features) {
    const dx = f.geometry.coordinates[0] - lon;
    const dy = f.geometry.coordinates[1] - lat;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      const raw = f.properties.moisture ?? f.properties.soil_moisture_0_to_1 ?? 0.3;
      // Normalize to 0-1 if raw value is in m³/m³ (typically 0-0.5)
      value = Math.min(1, raw <= 1 ? raw : raw / 100);
    }
  }

  return value;
}
