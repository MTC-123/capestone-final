/**
 * One-time script to generate a population density grid for Ifrane province.
 * Data source: HCP Morocco Census 2014 + 2020 projections (estimated).
 *
 * Run with: npx tsx scripts/generate-population-grid.ts
 *
 * Upgrade path: Replace output with WorldPop 100m GeoTIFF extraction.
 */

import * as fs from 'fs';
import * as path from 'path';

interface UrbanCenter {
  name: string;
  lon: number;
  lat: number;
  population: number;
  sigmaKm: number;
}

const URBAN_CENTERS: UrbanCenter[] = [
  { name: 'Azrou', lon: -5.22, lat: 33.44, population: 54000, sigmaKm: 1.5 },
  { name: 'Ifrane', lon: -5.11, lat: 33.53, population: 14000, sigmaKm: 1.0 },
  { name: 'Ain Leuh', lon: -5.35, lat: 33.29, population: 10000, sigmaKm: 0.8 },
  { name: 'Timahdit', lon: -5.07, lat: 33.23, population: 8000, sigmaKm: 0.6 },
  { name: 'Ben Smim', lon: -5.18, lat: 33.47, population: 7000, sigmaKm: 0.5 },
];

const PROVINCE_POPULATION = 155000;
const RURAL_DENSITY = 2; // people per km²
const GRID_STEP = 0.0045; // ~500m

// Ifrane province bounding box
const LAT_MIN = 33.15;
const LAT_MAX = 33.65;
const LON_MIN = -5.45;
const LON_MAX = -4.95;

// Approximate degrees to km at this latitude
const DEG_TO_KM_LAT = 111.32;
const DEG_TO_KM_LON = 111.32 * Math.cos((33.4 * Math.PI) / 180);

function gaussianWeight(dxKm: number, dyKm: number, sigmaKm: number): number {
  const r2 = dxKm * dxKm + dyKm * dyKm;
  return Math.exp(-r2 / (2 * sigmaKm * sigmaKm));
}

function generateGrid() {
  const cellAreaKm2 = (GRID_STEP * DEG_TO_KM_LAT) * (GRID_STEP * DEG_TO_KM_LON);
  const features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { pop: number };
  }> = [];

  // First pass: compute raw densities
  const rawPoints: Array<{ lon: number; lat: number; rawPop: number }> = [];
  let totalRaw = 0;

  for (let lat = LAT_MIN; lat <= LAT_MAX; lat += GRID_STEP) {
    for (let lon = LON_MIN; lon <= LON_MAX; lon += GRID_STEP) {
      let density = RURAL_DENSITY * cellAreaKm2;

      for (const center of URBAN_CENTERS) {
        const dxKm = (lon - center.lon) * DEG_TO_KM_LON;
        const dyKm = (lat - center.lat) * DEG_TO_KM_LAT;
        const w = gaussianWeight(dxKm, dyKm, center.sigmaKm);
        // Scale peak density by population and sigma
        const peakDensity = center.population / (2 * Math.PI * center.sigmaKm * center.sigmaKm);
        density += peakDensity * w * cellAreaKm2;
      }

      if (density >= 0.5) {
        rawPoints.push({ lon, lat, rawPop: density });
        totalRaw += density;
      }
    }
  }

  // Normalize to province total
  const scale = PROVINCE_POPULATION / totalRaw;

  for (const pt of rawPoints) {
    const pop = Math.round(pt.rawPop * scale);
    if (pop > 0) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [+pt.lon.toFixed(5), +pt.lat.toFixed(5)] },
        properties: { pop },
      });
    }
  }

  return {
    type: 'FeatureCollection' as const,
    features,
  };
}

// Main
const grid = generateGrid();
const totalPop = grid.features.reduce((sum, f) => sum + f.properties.pop, 0);

console.log(`Generated ${grid.features.length} grid cells`);
console.log(`Total population: ${totalPop.toLocaleString()}`);
console.log(`Max cell population: ${Math.max(...grid.features.map((f) => f.properties.pop))}`);

const outPath = path.join(__dirname, '..', 'public', 'data', 'ifrane-population-grid.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(grid));
console.log(`Written to ${outPath} (${(Buffer.byteLength(JSON.stringify(grid)) / 1024).toFixed(0)} KB)`);
