/**
 * Custom MapLibre protocol for client-side slope computation.
 *
 * Fetches terrain-RGB tiles, decodes elevation, computes slope in degrees,
 * and returns a colorized RGBA raster (green->yellow->orange->red by steepness).
 *
 * Uses the promise-based addProtocol API (maplibre-gl v4+).
 */

import maplibregl from 'maplibre-gl';

let baseUrl = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
let encoding: 'terrarium' | 'mapbox' = 'terrarium';

/**
 * Configure the elevation tile source before registering.
 */
export function configureSlopeProtocol(
  tileUrl: string,
  enc: 'terrarium' | 'mapbox'
): void {
  baseUrl = tileUrl;
  encoding = enc;
}

/**
 * Decode terrain-RGB pixels into elevation values (metres).
 */
export function decodeElevation(
  pixels: Uint8ClampedArray,
  size: number,
  enc: 'terrarium' | 'mapbox'
): Float32Array {
  const elevation = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    if (enc === 'terrarium') {
      elevation[i] = r * 256 + g + b / 256 - 32768;
    } else {
      // Mapbox encoding
      elevation[i] = ((r * 256 * 256 + g * 256 + b) * 0.1) - 10000;
    }
  }
  return elevation;
}

/**
 * Compute slope in degrees from an elevation grid.
 * Uses a 3x3 Sobel-like kernel (Horn's method).
 */
export function computeSlope(
  elevation: Float32Array,
  size: number,
  zoom: number
): Float32Array {
  const slope = new Float32Array(size * size);
  // Approximate cell size in metres (at equator; good enough for visualisation)
  const cellSize = (40075016.686 / (size * Math.pow(2, zoom)));

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = y * size + x;
      // Horn's formula
      const a = elevation[(y - 1) * size + (x - 1)];
      const b = elevation[(y - 1) * size + x];
      const c = elevation[(y - 1) * size + (x + 1)];
      const d = elevation[y * size + (x - 1)];
      const f = elevation[y * size + (x + 1)];
      const g = elevation[(y + 1) * size + (x - 1)];
      const h = elevation[(y + 1) * size + x];
      const ii = elevation[(y + 1) * size + (x + 1)];

      const dzdx = ((c + 2 * f + ii) - (a + 2 * d + g)) / (8 * cellSize);
      const dzdy = ((g + 2 * h + ii) - (a + 2 * b + c)) / (8 * cellSize);

      slope[idx] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * (180 / Math.PI);
    }
  }
  return slope;
}

/**
 * Map slope degrees to fire-risk RGBA colours.
 * <10 deg green (low), 10-20 deg yellow (moderate), 20-30 deg orange (high), >30 deg red (extreme).
 */
export function colorizeSlope(
  slope: Float32Array,
  size: number
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const s = slope[i];
    const px = i * 4;
    if (s < 0.5) {
      // Flat / edge pixel — transparent
      rgba[px] = 0;
      rgba[px + 1] = 0;
      rgba[px + 2] = 0;
      rgba[px + 3] = 0;
    } else if (s < 10) {
      // Green: #4caf50
      rgba[px] = 76;
      rgba[px + 1] = 175;
      rgba[px + 2] = 80;
      rgba[px + 3] = 160;
    } else if (s < 20) {
      // Yellow: #ffeb3b
      rgba[px] = 255;
      rgba[px + 1] = 235;
      rgba[px + 2] = 59;
      rgba[px + 3] = 180;
    } else if (s < 30) {
      // Orange: #ff9800
      rgba[px] = 255;
      rgba[px + 1] = 152;
      rgba[px + 2] = 0;
      rgba[px + 3] = 200;
    } else {
      // Red: #f44336
      rgba[px] = 244;
      rgba[px + 1] = 67;
      rgba[px + 2] = 54;
      rgba[px + 3] = 220;
    }
  }
  return rgba;
}

/**
 * Fetch a terrain tile, compute slope, and return a colorized PNG as ArrayBuffer.
 */
async function handleSlopeTile(
  z: number,
  x: number,
  y: number,
  abortController: AbortController
): Promise<{ data: ArrayBuffer }> {
  const url = baseUrl
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));

  const response = await fetch(url, { signal: abortController.signal });
  if (!response.ok) {
    throw new Error(`Terrain tile fetch failed: ${response.status}`);
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const size = bitmap.width;

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, size, size);
  const elevation = decodeElevation(imageData.data, size, encoding);
  const slope = computeSlope(elevation, size, z);
  const rgba = colorizeSlope(slope, size);

  // Write back to canvas and export as PNG
  // Cast needed: TS5 types Uint8ClampedArray.buffer as ArrayBufferLike but ImageData requires ArrayBuffer
  const output = new ImageData(rgba as unknown as Uint8ClampedArray<ArrayBuffer>, size, size);
  ctx.putImageData(output, 0, 0);

  const outputBlob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await outputBlob.arrayBuffer();

  return { data: buffer };
}

/**
 * Register the `slope://` custom protocol with MapLibre.
 * Uses the promise-based API required by maplibre-gl v4+.
 */
export function registerSlopeProtocol(): void {
  maplibregl.addProtocol('slope', (params, abortController) => {
    // Parse tile coordinates from slope://{z}/{x}/{y}
    const parts = params.url.replace('slope://', '').split('/');
    const z = parseInt(parts[0], 10);
    const x = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);

    return handleSlopeTile(z, x, y, abortController);
  });
}

/**
 * Unregister the `slope://` custom protocol.
 */
export function unregisterSlopeProtocol(): void {
  maplibregl.removeProtocol('slope');
}
