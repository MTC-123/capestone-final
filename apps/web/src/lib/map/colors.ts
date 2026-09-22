/**
 * Centralized color definitions for map visualizations
 * Single source of truth for all incident, resource, and equipment colors
 */

export const INCIDENT_STATUS_COLORS: Record<string, string> = {
  VIGILANCE: '#f59e0b',
  ALERTE: '#f97316',
  INTERVENTION: '#ef4444',
  MAITRISE: '#8b5cf6',
  ETEINT: '#6b7280',
};

export const RESOURCE_TYPE_COLORS: Record<string, string> = {
  TRUCK: '#22c55e',
  AIRCRAFT: '#3b82f6',
  PERSONNEL: '#f59e0b',
  EQUIPMENT: '#ec4899',
};

export const INFRASTRUCTURE_TYPE_COLORS: Record<string, string> = {
  WATCHTOWER: '#7c3aed',
  WATER_POINT: '#0ea5e9',
  STATION: '#14b8a6',
  FIREBREAK: '#8b5cf6',
  HELIPAD: '#6366f1',
};

export const RETARDANT_COLOR = '#f43f5e'; // rose-500

export const TRUCK_STATUS_COLORS: Record<string, string> = {
  'Disponible': '#22c55e',
  'En route': '#f97316',
  'En intervention': '#ef4444',
};

/**
 * FIRMS detection confidence level colors
 * High confidence = red (likely fire)
 * Nominal confidence = orange (probable fire)
 * Low confidence = gray (possible fire or false positive)
 */
export const FIRMS_CONFIDENCE_COLORS: Record<string, string> = {
  low: '#9ca3af', // gray-400 - low confidence detections
  nominal: '#f59e0b', // amber-500 - nominal confidence
  high: '#ef4444', // red-500 - high confidence fire
};

/**
 * Fire Radiative Power (FRP) gradient for intensity visualization
 * FRP measured in MegaWatts (MW)
 * Low: < 10 MW (smoldering, small fire)
 * Medium: 10-50 MW (active fire)
 * High: > 50 MW (intense fire)
 */
export const FIRMS_FRP_GRADIENT = {
  low: { threshold: 10, color: '#fef3c7' }, // amber-50
  medium: { threshold: 50, color: '#f59e0b' }, // amber-500
  high: { threshold: 100, color: '#dc2626' }, // red-600
  extreme: { threshold: 200, color: '#991b1b' }, // red-800
};

/**
 * EFFIS Fire Weather Index color ramp
 */
export const EFFIS_FWI_COLORS = {
  low: '#22c55e',      // green-500
  moderate: '#f59e0b',  // amber-500
  high: '#ef4444',      // red-500
  extreme: '#7f1d1d',   // red-900
};

/**
 * EFFIS Burned Area color
 */
export const EFFIS_BURNED_AREA_COLOR = '#7f1d1d'; // red-900

/**
 * Soil Moisture color ramp (m³/m³)
 * Dry = brown/red, Moderate = green, Wet = blue
 */
export const SOIL_MOISTURE_COLORS = {
  dry: '#b45309',      // amber-700  (<0.1 m³/m³)
  low: '#22c55e',      // green-500  (0.1–0.2)
  normal: '#22d3ee',   // cyan-400   (0.2–0.3)
  wet: '#3b82f6',      // blue-500   (>0.3)
};

/**
 * NDVI vegetation stress color ramp
 * Stressed/bare = brown, Sparse = yellow, Moderate = light green, Healthy = dark green
 */
export const NDVI_COLORS = {
  stressed: '#8B4513',  // brown (<0.2)
  sparse: '#FFFF00',    // yellow (0.2-0.4)
  moderate: '#90EE90',  // light green (0.4-0.6)
  healthy: '#006400',   // dark green (>0.6)
};

/**
 * Water reservoir colors
 */
export const RESERVOIR_COLORS = {
  marker: '#3b82f6',    // blue-500
  label: '#1e40af',     // blue-800
};

/**
 * PAMF (Pression Annuelle Moyenne des Feux) choropleth color ramp
 * Fire pressure index: fires per km² per year
 * Thresholds: 0–0.5 (low), 0.5–1.5 (moderate), 1.5–3.0 (high), >3.0 (very high)
 */
export const PAMF_COLORS = {
  low: '#22c55e',       // green-500  (0–0.5)
  moderate: '#eab308',  // yellow-500 (0.5–1.5)
  high: '#f97316',      // orange-500 (1.5–3.0)
  extreme: '#ef4444',   // red-500    (>3.0)
  noData: '#9ca3af',    // gray-400
};

/**
 * RMA (Ratio Moyen Annuel de surfaces brûlées) choropleth color ramp
 * Burned area ratio: burned ha / forested ha as percentage
 * Thresholds: 0–0.1% (low), 0.1–0.5% (moderate), 0.5–1% (high), >1% (very high)
 */
export const RMA_COLORS = {
  low: '#bfdbfe',       // blue-200   (0–0.1%)
  moderate: '#3b82f6',  // blue-500   (0.1–0.5%)
  high: '#8b5cf6',      // violet-500 (0.5–1%)
  extreme: '#6d28d9',   // violet-700 (>1%)
  noData: '#9ca3af',    // gray-400
};

/** @deprecated Use PAMF_COLORS or RMA_COLORS instead */
export const PAMF_RMA_COLORS = PAMF_COLORS;

/**
 * CAMS Aerosol Optical Depth color ramp (blue-yellow-red)
 * Matches the sh_BuYlRd_aod WMS style
 */
export const CAMS_AEROSOL_COLORS = {
  low: '#2166ac',      // blue
  moderate: '#f7f056',  // yellow
  high: '#b2182b',      // red
};

/**
 * Terrain slope fire-risk color ramp
 * <10 deg green (low risk), 10-20 deg yellow (moderate), 20-30 deg orange (high), >30 deg red (extreme)
 */
export const SLOPE_COLORS_HEX = {
  low: '#4caf50',      // green (<10 deg)
  moderate: '#ffeb3b',  // yellow (10-20 deg)
  high: '#ff9800',      // orange (20-30 deg)
  extreme: '#f44336',   // red (>30 deg)
};

/**
 * ESA WorldCover 2021 land cover class colors (10m resolution)
 * Maps directly to fire fuel types for dispatch decision-making
 */
export const LAND_COVER_COLORS: Record<number, string> = {
  10: '#006400',  // Tree cover
  20: '#FFBB22',  // Shrubland
  30: '#FFFF4C',  // Grassland
  40: '#F096FF',  // Cropland
  50: '#FA0000',  // Built-up
  60: '#B4B4B4',  // Bare / sparse vegetation
  80: '#0064C8',  // Permanent water
  90: '#0096A0',  // Herbaceous wetland
  95: '#00CF75',  // Mangrove
  100: '#FAE6A0', // Moss / lichen
};

/**
 * Population density heatmap color ramp (yellow → orange → red → dark red)
 * Matches census-estimated density bands for Ifrane province
 */
export const POPULATION_DENSITY_COLORS = {
  low: '#ffffcc',       // light yellow (sparse)
  moderate: '#fd8d3c',  // orange (moderate density)
  high: '#e31a1c',      // red (urban/dense)
  extreme: '#800026',   // dark red (city center)
};

/**
 * Fire spread prediction risk-level color ramp
 * Matches the Rothermel model output risk classifications
 */
export const FIRE_SPREAD_COLORS = {
  low: '#4caf50',       // green — slow/minimal spread
  moderate: '#ffeb3b',  // yellow — moderate spread
  high: '#ff9800',      // orange — fast spread
  extreme: '#f44336',   // red — extreme spread
};

/**
 * Get color based on FRP value (for glow effects)
 */
export function getFRPColor(frp: number): string {
  if (frp >= FIRMS_FRP_GRADIENT.extreme.threshold) return FIRMS_FRP_GRADIENT.extreme.color;
  if (frp >= FIRMS_FRP_GRADIENT.high.threshold) return FIRMS_FRP_GRADIENT.high.color;
  if (frp >= FIRMS_FRP_GRADIENT.medium.threshold) return FIRMS_FRP_GRADIENT.medium.color;
  return FIRMS_FRP_GRADIENT.low.color;
}
