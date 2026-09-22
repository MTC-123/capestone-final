/**
 * Simplified Rothermel (1972) fire spread model.
 *
 * Synthesizes wind, slope, fuel type, and soil moisture into
 * directional spread vectors. Pure math — zero runtime dependencies.
 */

export interface SpreadInput {
  windSpeed: number;      // km/h (from Open-Meteo grid)
  windDirection: number;  // degrees from north (meteorological)
  slope: number;          // degrees (from terrain grid)
  aspect: number;         // degrees 0-360, direction the slope faces (from terrain grid)
  fuelType: number;       // ESA WorldCover class (from fuel grid)
  soilMoisture: number;   // 0-1 normalized (from soil moisture grid)
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme';

export interface SpreadOutput {
  direction: number;      // degrees — primary spread direction
  relativeRate: number;   // 0-1 normalized spread rate
  riskLevel: RiskLevel;
}

/**
 * Fuel base rates by ESA WorldCover class.
 * Higher = faster spread.
 */
const FUEL_PARAMS: Record<number, number> = {
  10: 0.8,   // Tree cover (cedar forest)
  20: 1.0,   // Shrubland
  30: 1.2,   // Grassland
  40: 0.6,   // Cropland
  50: 0.1,   // Built-up
  60: 0.05,  // Bare / sparse vegetation
  80: 0.0,   // Water
  90: 0.3,   // Herbaceous wetland
  95: 0.4,   // Mangrove
  100: 0.2,  // Moss / lichen
};

/**
 * Weighted circular mean of two angles (degrees).
 * Handles wraparound correctly (e.g. 350° + 10° → ~0°).
 */
export function weightedCircularMean(
  angle1Deg: number,
  angle2Deg: number,
  weight1: number,
  weight2: number,
): number {
  const a1 = (angle1Deg * Math.PI) / 180;
  const a2 = (angle2Deg * Math.PI) / 180;
  const x = weight1 * Math.cos(a1) + weight2 * Math.cos(a2);
  const y = weight1 * Math.sin(a1) + weight2 * Math.sin(a2);
  let result = (Math.atan2(y, x) * 180) / Math.PI;
  if (result < 0) result += 360;
  return result;
}

/**
 * Compute a destination point given origin, bearing, and distance.
 * Uses spherical Earth approximation (good enough for <10km).
 */
export function computeEndpoint(
  lon: number,
  lat: number,
  bearingDeg: number,
  distanceKm: number,
): [number, number] {
  const R = 6371; // Earth radius in km
  const d = distanceKm / R;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/**
 * Calculate fire spread direction, rate, and risk level.
 */
export function calculateSpread(input: SpreadInput): SpreadOutput {
  const { windSpeed, windDirection, slope, aspect, fuelType, soilMoisture } = input;

  // 1. Fuel base rate
  const fuelBase = FUEL_PARAMS[fuelType] ?? 0.1;
  if (fuelBase === 0) {
    return { direction: 0, relativeRate: 0, riskLevel: 'low' };
  }

  // 2. Wind factor: 1 + 0.3 * (windSpeed_m_s)^1.5
  const windSpeedMs = windSpeed / 3.6;
  const windFactor = 1 + 0.3 * Math.pow(windSpeedMs, 1.5);

  // 3. Slope factor: 1 + 5.275 * tan²(slopeRad) (Byram 1959)
  const slopeRad = (slope * Math.PI) / 180;
  const slopeFactor = 1 + 5.275 * Math.pow(Math.tan(slopeRad), 2);

  // 4. Moisture dampening: max(0.1, 1 - soilMoisture * 0.7)
  const moistureFactor = Math.max(0.1, 1 - soilMoisture * 0.7);

  // 5. Combined direction: weighted circular mean of wind direction + upslope direction
  // Upslope direction = aspect + 180 (fire burns uphill)
  const upslopeDirection = (aspect + 180) % 360;
  const windWeight = Math.min(windSpeedMs / 10, 0.8);
  const slopeWeight = 1 - windWeight;
  const direction = weightedCircularMean(
    windDirection,
    upslopeDirection,
    windWeight,
    slopeWeight,
  );

  // 6. Combined rate: min(1, fuelBase * windFactor * slopeFactor * moistureFactor / 20)
  const relativeRate = Math.min(
    1,
    (fuelBase * windFactor * slopeFactor * moistureFactor) / 20,
  );

  // 7. Risk classification
  let riskLevel: RiskLevel;
  if (relativeRate < 0.25) riskLevel = 'low';
  else if (relativeRate < 0.5) riskLevel = 'moderate';
  else if (relativeRate < 0.75) riskLevel = 'high';
  else riskLevel = 'extreme';

  return { direction, relativeRate, riskLevel };
}
