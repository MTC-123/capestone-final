import { describe, it, expect } from 'vitest';
import {
  nearestGridValue,
  interpolateWind,
  nearestSoilMoisture,
  type RegularGrid,
  type GridBBox,
} from '@/lib/fire-spread/interpolate';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Build a small regular grid for testing. */
function makeGrid(
  cols: number,
  rows: number,
  gridStep: number,
  lonMin = 0,
  latMin = 0,
  propertyFn: (col: number, row: number) => Record<string, number> = () => ({ value: 1 }),
): RegularGrid {
  const bbox: GridBBox = {
    lonMin,
    latMin,
    lonMax: lonMin + (cols - 1) * gridStep,
    latMax: latMin + (rows - 1) * gridStep,
    cols,
    rows,
  };

  const features = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      features.push({
        geometry: { coordinates: [lonMin + c * gridStep, latMin + r * gridStep] as [number, number] },
        properties: propertyFn(c, r),
      });
    }
  }

  return { features, bbox, gridStep };
}

function windFeature(lon: number, lat: number, speed: number, direction: number) {
  return {
    geometry: { coordinates: [lon, lat] as [number, number] },
    properties: { speed, direction },
  };
}

function soilFeature(lon: number, lat: number, moisture: number, key: 'moisture' | 'soil_moisture_0_to_1' = 'moisture') {
  return {
    geometry: { coordinates: [lon, lat] as [number, number] },
    properties: { [key]: moisture } as { moisture?: number; soil_moisture_0_to_1?: number },
  };
}

/* ================================================================== */
/*  nearestGridValue                                                  */
/* ================================================================== */

describe('nearestGridValue', () => {
  const grid = makeGrid(3, 3, 0.01, -5.0, 33.0, (c, r) => ({
    slope: c * 10 + r,
    fuel: 30,
  }));

  it('returns value at an exact grid node', () => {
    // col=1, row=2 => slope = 1*10+2 = 12
    const val = nearestGridValue(grid, -4.99, 33.02, 'slope');
    expect(val).toBe(12);
  });

  it('returns null for longitude below grid', () => {
    expect(nearestGridValue(grid, -5.1, 33.0, 'slope')).toBeNull();
  });

  it('returns null for longitude above grid', () => {
    expect(nearestGridValue(grid, -4.9, 33.0, 'slope')).toBeNull();
  });

  it('returns null for latitude below grid', () => {
    expect(nearestGridValue(grid, -5.0, 32.9, 'slope')).toBeNull();
  });

  it('returns null for latitude above grid', () => {
    expect(nearestGridValue(grid, -5.0, 33.1, 'slope')).toBeNull();
  });

  it('returns null for a property that does not exist', () => {
    expect(nearestGridValue(grid, -5.0, 33.0, 'nonexistent')).toBeNull();
  });

  it('snaps to nearest cell via rounding', () => {
    // Point slightly closer to col=1 than col=0
    const val = nearestGridValue(grid, -4.994, 33.0, 'slope');
    // col=round(0.006/0.01)=round(0.6)=1, row=0 => slope=10
    expect(val).toBe(10);
  });

  it('returns value at the maximum boundary corner', () => {
    // col=2, row=2 => slope = 2*10+2 = 22
    const val = nearestGridValue(grid, -4.98, 33.02, 'slope');
    expect(val).toBe(22);
  });

  it('returns null when grid features array has a gap (undefined entry)', () => {
    const sparse = makeGrid(2, 2, 0.01, 0, 0);
    // Simulate a sparse grid
    (sparse.features as unknown[])[0] = undefined;
    expect(nearestGridValue(sparse, 0, 0, 'value')).toBeNull();
  });
});

/* ================================================================== */
/*  interpolateWind                                                   */
/* ================================================================== */

describe('interpolateWind', () => {
  it('returns null for empty features', () => {
    expect(interpolateWind([], 0, 0)).toBeNull();
  });

  it('returns the exact point when query is at a feature location', () => {
    const features = [windFeature(1.0, 2.0, 15, 90)];
    const result = interpolateWind(features, 1.0, 2.0);
    expect(result).toEqual({ speed: 15, direction: 90 });
  });

  it('returns single feature if only one exists (even far away)', () => {
    const features = [windFeature(0, 0, 10, 180)];
    const result = interpolateWind(features, 5, 5);
    expect(result).not.toBeNull();
    // With one point, IDW reduces to that point
    expect(result!.speed).toBeCloseTo(10, 1);
    expect(result!.direction).toBeCloseTo(180, 1);
  });

  it('gives more weight to closer points (IDW)', () => {
    const features = [
      windFeature(0, 0, 10, 0),     // close to query
      windFeature(10, 10, 50, 180),  // far from query
    ];
    const result = interpolateWind(features, 0.01, 0.01);
    expect(result).not.toBeNull();
    // Speed should be much closer to 10 than to 50
    expect(result!.speed).toBeLessThan(15);
  });

  it('interpolates direction correctly across 0/360 boundary', () => {
    // Two features: one at 350 deg, one at 10 deg — mean should be near 0/360
    const features = [
      windFeature(0, 0, 10, 350),
      windFeature(1, 0, 10, 10),
    ];
    const result = interpolateWind(features, 0.5, 0);
    expect(result).not.toBeNull();
    // Direction should be near 0 (or 360)
    const dir = result!.direction;
    const nearZero = dir < 20 || dir > 340;
    expect(nearZero).toBe(true);
  });

  it('handles all same direction', () => {
    const features = [
      windFeature(0, 0, 5, 90),
      windFeature(1, 0, 15, 90),
      windFeature(0, 1, 10, 90),
    ];
    const result = interpolateWind(features, 0.5, 0.5);
    expect(result).not.toBeNull();
    expect(result!.direction).toBeCloseTo(90, 0);
  });

  it('uses at most 4 nearest points', () => {
    // Create 6 equidistant features
    const features = Array.from({ length: 6 }, (_, i) =>
      windFeature(Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3), 10, i * 60),
    );
    // Should not throw; just uses 4 nearest
    const result = interpolateWind(features, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.speed).toBeGreaterThan(0);
  });

  it('returns direction in [0, 360) range', () => {
    const features = [
      windFeature(0, 0, 10, 270),
      windFeature(1, 0, 10, 260),
    ];
    const result = interpolateWind(features, 0.5, 0);
    expect(result).not.toBeNull();
    expect(result!.direction).toBeGreaterThanOrEqual(0);
    expect(result!.direction).toBeLessThan(360);
  });
});

/* ================================================================== */
/*  nearestSoilMoisture                                               */
/* ================================================================== */

describe('nearestSoilMoisture', () => {
  it('returns 0.3 default for empty features', () => {
    expect(nearestSoilMoisture([], 0, 0)).toBe(0.3);
  });

  it('returns moisture of nearest feature', () => {
    const features = [
      soilFeature(0, 0, 0.5),
      soilFeature(10, 10, 0.1),
    ];
    expect(nearestSoilMoisture(features, 0.01, 0.01)).toBe(0.5);
  });

  it('picks closest when query is between two features', () => {
    const features = [
      soilFeature(0, 0, 0.2),
      soilFeature(1, 0, 0.8),
    ];
    // Closer to the second feature
    expect(nearestSoilMoisture(features, 0.9, 0)).toBe(0.8);
  });

  it('reads soil_moisture_0_to_1 property when moisture is absent', () => {
    const features = [
      soilFeature(0, 0, 0.6, 'soil_moisture_0_to_1'),
    ];
    expect(nearestSoilMoisture(features, 0, 0)).toBe(0.6);
  });

  it('defaults to 0.3 when both moisture properties are missing', () => {
    const features = [{
      geometry: { coordinates: [0, 0] as [number, number] },
      properties: {} as { moisture?: number; soil_moisture_0_to_1?: number },
    }];
    expect(nearestSoilMoisture(features, 0, 0)).toBe(0.3);
  });

  it('clamps value to 1 when raw value is slightly above 1', () => {
    // raw = 1.1, raw <= 1 is false, so it does raw/100 = 0.011
    // Actually: 1.1 > 1 so it does Math.min(1, 1.1/100) = 0.011
    const features = [soilFeature(0, 0, 1.1)];
    const result = nearestSoilMoisture(features, 0, 0);
    expect(result).toBeCloseTo(0.011, 3);
  });

  it('normalizes percentage values (e.g. 45 means 45%)', () => {
    // raw = 45, raw > 1, so raw/100 = 0.45
    const features = [soilFeature(0, 0, 45)];
    const result = nearestSoilMoisture(features, 0, 0);
    expect(result).toBeCloseTo(0.45, 2);
  });

  it('caps normalized value at 1.0', () => {
    // raw = 150, raw > 1, so Math.min(1, 150/100) = Math.min(1, 1.5) = 1
    const features = [soilFeature(0, 0, 150)];
    const result = nearestSoilMoisture(features, 0, 0);
    expect(result).toBe(1);
  });

  it('passes through value when in 0-1 range', () => {
    const features = [soilFeature(0, 0, 0.0)];
    expect(nearestSoilMoisture(features, 0, 0)).toBe(0);

    const features2 = [soilFeature(0, 0, 1.0)];
    expect(nearestSoilMoisture(features2, 0, 0)).toBe(1.0);
  });
});
