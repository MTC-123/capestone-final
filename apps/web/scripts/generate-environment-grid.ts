/**
 * One-time script to generate terrain + fuel type grid for Ifrane province.
 * Uses known elevation control points and IDW interpolation for terrain,
 * and elevation-based heuristics for fuel type classification.
 *
 * Run with: npx tsx scripts/generate-environment-grid.ts
 *
 * Upgrade path:
 * - Replace elevation control points with Copernicus DEM GeoTIFF extraction
 * - Replace fuel estimation with ESA WorldCover GeoTIFF extraction
 */

import * as fs from 'fs';
import * as path from 'path';

// Ifrane province bounding box (same as population grid)
const LAT_MIN = 33.15;
const LAT_MAX = 33.65;
const LON_MIN = -5.45;
const LON_MAX = -4.95;
const GRID_STEP = 0.014; // ~1.5km

// Approximate degrees to km at this latitude
const DEG_TO_KM_LAT = 111.32;
const DEG_TO_KM_LON = 111.32 * Math.cos((33.4 * Math.PI) / 180);

interface ElevationPoint {
  name: string;
  lon: number;
  lat: number;
  elevation: number; // meters
}

const ELEVATION_POINTS: ElevationPoint[] = [
  { name: 'Azrou', lon: -5.22, lat: 33.44, elevation: 1250 },
  { name: 'Ifrane', lon: -5.11, lat: 33.53, elevation: 1650 },
  { name: 'Michlifen', lon: -5.08, lat: 33.41, elevation: 2000 },
  { name: 'Jebel Hebri', lon: -5.15, lat: 33.35, elevation: 3190 },
  { name: 'Timahdit', lon: -5.07, lat: 33.23, elevation: 1800 },
  { name: 'Ain Leuh', lon: -5.35, lat: 33.29, elevation: 1400 },
  { name: 'Ben Smim', lon: -5.18, lat: 33.47, elevation: 1400 },
  // Additional control points for smoother interpolation
  { name: 'NW corner', lon: -5.40, lat: 33.60, elevation: 1100 },
  { name: 'NE corner', lon: -5.00, lat: 33.60, elevation: 1200 },
  { name: 'SE corner', lon: -5.00, lat: 33.20, elevation: 1500 },
  { name: 'SW corner', lon: -5.40, lat: 33.20, elevation: 1100 },
  { name: 'Plateau N', lon: -5.20, lat: 33.55, elevation: 1500 },
  { name: 'Valley S', lon: -5.20, lat: 33.25, elevation: 1600 },
];

interface UrbanCenter {
  lon: number;
  lat: number;
  sigmaKm: number;
}

const URBAN_CENTERS: UrbanCenter[] = [
  { lon: -5.22, lat: 33.44, sigmaKm: 0.5 }, // Azrou
  { lon: -5.11, lat: 33.53, sigmaKm: 0.5 }, // Ifrane
  { lon: -5.35, lat: 33.29, sigmaKm: 0.4 }, // Ain Leuh
  { lon: -5.07, lat: 33.23, sigmaKm: 0.3 }, // Timahdit
  { lon: -5.18, lat: 33.47, sigmaKm: 0.3 }, // Ben Smim
];

/**
 * IDW interpolation of elevation at a point from control points.
 */
function interpolateElevation(lon: number, lat: number): number {
  let weightSum = 0;
  let valueSum = 0;

  for (const pt of ELEVATION_POINTS) {
    const dxKm = (pt.lon - lon) * DEG_TO_KM_LON;
    const dyKm = (pt.lat - lat) * DEG_TO_KM_LAT;
    const dist = Math.sqrt(dxKm * dxKm + dyKm * dyKm);

    if (dist < 0.01) return pt.elevation; // essentially at the point

    const w = 1 / Math.pow(dist, 2);
    weightSum += w;
    valueSum += w * pt.elevation;
  }

  return valueSum / weightSum;
}

/**
 * Check if a point is near an urban center.
 */
function urbanProximity(lon: number, lat: number): number {
  let maxWeight = 0;
  for (const uc of URBAN_CENTERS) {
    const dxKm = (uc.lon - lon) * DEG_TO_KM_LON;
    const dyKm = (uc.lat - lat) * DEG_TO_KM_LAT;
    const dist = Math.sqrt(dxKm * dxKm + dyKm * dyKm);
    const w = Math.exp(-(dist * dist) / (2 * uc.sigmaKm * uc.sigmaKm));
    if (w > maxWeight) maxWeight = w;
  }
  return maxWeight;
}

/**
 * Estimate fuel type from elevation and urban proximity.
 * Returns ESA WorldCover class number.
 */
function estimateFuelType(elevation: number, urbanWeight: number): number {
  if (urbanWeight > 0.5) return 50;       // Built-up
  if (elevation > 2800) return 60;        // Bare/sparse (high alpine)
  if (elevation > 2200) return 30;        // Grassland (alpine meadow)
  if (elevation >= 1400 && elevation <= 2200) return 10; // Cedar forest
  if (elevation >= 1200 && elevation < 1400) return 20;  // Shrubland transition
  if (elevation < 1200) {
    if (urbanWeight > 0.1) return 50;     // Built-up fringe
    return 40;                             // Cropland
  }
  return 20; // Default to shrubland
}

function generateGrid() {
  // First, build elevation grid for slope/aspect computation
  const cols = Math.ceil((LON_MAX - LON_MIN) / GRID_STEP) + 1;
  const rows = Math.ceil((LAT_MAX - LAT_MIN) / GRID_STEP) + 1;

  // Elevation grid [row][col]
  const elevGrid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    elevGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      const lon = LON_MIN + c * GRID_STEP;
      const lat = LAT_MIN + r * GRID_STEP;
      elevGrid[r][c] = interpolateElevation(lon, lat);
    }
  }

  // Compute slope and aspect from elevation differences
  const cellDistX = GRID_STEP * DEG_TO_KM_LON * 1000; // meters
  const cellDistY = GRID_STEP * DEG_TO_KM_LAT * 1000; // meters

  const features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { slope: number; aspect: number; fuel: number };
  }> = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lon = LON_MIN + c * GRID_STEP;
      const lat = LAT_MIN + r * GRID_STEP;

      // Slope & aspect from finite differences
      const eC = elevGrid[r][c];
      const eE = c < cols - 1 ? elevGrid[r][c + 1] : eC;
      const eW = c > 0 ? elevGrid[r][c - 1] : eC;
      const eN = r < rows - 1 ? elevGrid[r + 1][c] : eC;
      const eS = r > 0 ? elevGrid[r - 1][c] : eC;

      const dEdx = (eE - eW) / (2 * cellDistX); // ΔE/Δx
      const dEdy = (eN - eS) / (2 * cellDistY); // ΔE/Δy

      const slopeRad = Math.atan(Math.sqrt(dEdx * dEdx + dEdy * dEdy));
      const slopeDeg = (slopeRad * 180) / Math.PI;

      let aspectDeg = (Math.atan2(dEdx, dEdy) * 180) / Math.PI;
      if (aspectDeg < 0) aspectDeg += 360;

      // Fuel type
      const urbanW = urbanProximity(lon, lat);
      const fuel = estimateFuelType(eC, urbanW);

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(lon.toFixed(5)), parseFloat(lat.toFixed(5))] },
        properties: {
          slope: parseFloat(slopeDeg.toFixed(1)),
          aspect: parseFloat(aspectDeg.toFixed(0)),
          fuel,
        },
      });
    }
  }

  const grid = {
    type: 'FeatureCollection',
    bbox: {
      lonMin: LON_MIN,
      latMin: LAT_MIN,
      lonMax: LON_MAX,
      latMax: LAT_MAX,
      cols,
      rows,
    },
    gridStep: GRID_STEP,
    features,
  };

  const outPath = path.join(__dirname, '..', 'public', 'data', 'ifrane-environment-grid.json');
  fs.writeFileSync(outPath, JSON.stringify(grid));

  const sizeKB = (Buffer.byteLength(JSON.stringify(grid)) / 1024).toFixed(0);
  console.log(`Generated ${features.length} grid cells (${cols}x${rows})`);
  console.log(`Output: ${outPath} (${sizeKB} KB)`);
}

generateGrid();
