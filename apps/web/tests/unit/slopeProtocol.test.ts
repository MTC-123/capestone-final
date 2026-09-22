import { describe, it, expect, vi } from 'vitest';

vi.mock('maplibre-gl', () => ({
  default: { addProtocol: vi.fn(), removeProtocol: vi.fn() },
}));

import { decodeElevation, computeSlope, colorizeSlope } from '@/lib/map/slopeProtocol';

describe('decodeElevation', () => {
  it('decodes terrarium encoding: all zeros → -32768', () => {
    const px = new Uint8ClampedArray(4); // r=0,g=0,b=0,a=255
    px[3] = 255;
    const elev = decodeElevation(px, 1, 'terrarium');
    expect(elev[0]).toBeCloseTo(-32768);
  });

  it('decodes terrarium encoding: (128,0,0) → 0m', () => {
    const px = new Uint8ClampedArray(4);
    px[0] = 128; px[3] = 255;
    const elev = decodeElevation(px, 1, 'terrarium');
    expect(elev[0]).toBeCloseTo(0);
  });

  it('decodes mapbox encoding: (0,0,0) → -10000m', () => {
    const px = new Uint8ClampedArray(4);
    px[3] = 255;
    const elev = decodeElevation(px, 1, 'mapbox');
    expect(elev[0]).toBeCloseTo(-10000);
  });

  it('decodes mapbox encoding: (1,134,160) → 0m', () => {
    const px = new Uint8ClampedArray(4);
    px[0] = 1; px[1] = 134; px[2] = 160; px[3] = 255;
    const elev = decodeElevation(px, 1, 'mapbox');
    expect(elev[0]).toBeCloseTo(0, 0);
  });

  it('handles a 2x2 grid', () => {
    const px = new Uint8ClampedArray(16);
    for (let i = 0; i < 4; i++) {
      px[i * 4] = 128;
      px[i * 4 + 3] = 255;
    }
    const elev = decodeElevation(px, 2, 'terrarium');
    expect(elev).toHaveLength(4);
    elev.forEach((v) => expect(v).toBeCloseTo(0));
  });

  it('distinguishes different pixel values', () => {
    const px = new Uint8ClampedArray(8);
    px[0] = 128; px[3] = 255; // pixel 0 → 0m
    px[4] = 129; px[7] = 255; // pixel 1 → 256m
    const elev = decodeElevation(px, 2, 'terrarium');
    expect(elev[0]).toBeCloseTo(0);
    expect(elev[1]).toBeCloseTo(256);
  });
});

describe('computeSlope', () => {
  it('returns zero slope for flat terrain', () => {
    const size = 4;
    const elev = new Float32Array(size * size).fill(100);
    const slope = computeSlope(elev, size, 10);
    // Interior pixels should be ~0
    expect(slope[5]).toBeCloseTo(0, 1);
    expect(slope[6]).toBeCloseTo(0, 1);
    expect(slope[9]).toBeCloseTo(0, 1);
    expect(slope[10]).toBeCloseTo(0, 1);
  });

  it('returns non-zero slope for a ramp', () => {
    const size = 4;
    const elev = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        elev[y * size + x] = x * 1000; // steep east-facing ramp
      }
    }
    const slope = computeSlope(elev, size, 10);
    // Interior pixels should have measurable slope
    expect(slope[5]).toBeGreaterThan(0);
    expect(slope[6]).toBeGreaterThan(0);
  });

  it('edge pixels remain zero (boundary condition)', () => {
    const size = 4;
    const elev = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) elev[i] = i * 100;
    const slope = computeSlope(elev, size, 10);
    // Edges (y=0 or y=size-1 or x=0 or x=size-1) stay 0
    expect(slope[0]).toBe(0);
    expect(slope[3]).toBe(0);
    expect(slope[12]).toBe(0);
    expect(slope[15]).toBe(0);
  });
});

describe('colorizeSlope', () => {
  it('transparent for flat (< 0.5 deg)', () => {
    const slope = new Float32Array([0.1]);
    const rgba = colorizeSlope(slope, 1);
    expect(rgba[3]).toBe(0); // alpha = 0
  });

  it('green for low slope (< 10 deg)', () => {
    const slope = new Float32Array([5]);
    const rgba = colorizeSlope(slope, 1);
    expect(rgba[0]).toBe(76);  // R
    expect(rgba[1]).toBe(175); // G
    expect(rgba[2]).toBe(80);  // B
    expect(rgba[3]).toBe(160); // A
  });

  it('yellow for moderate slope (10-20 deg)', () => {
    const slope = new Float32Array([15]);
    const rgba = colorizeSlope(slope, 1);
    expect(rgba[0]).toBe(255); // R
    expect(rgba[1]).toBe(235); // G
    expect(rgba[2]).toBe(59);  // B
  });

  it('orange for high slope (20-30 deg)', () => {
    const slope = new Float32Array([25]);
    const rgba = colorizeSlope(slope, 1);
    expect(rgba[0]).toBe(255); // R
    expect(rgba[1]).toBe(152); // G
    expect(rgba[2]).toBe(0);   // B
  });

  it('red for extreme slope (>= 30 deg)', () => {
    const slope = new Float32Array([35]);
    const rgba = colorizeSlope(slope, 1);
    expect(rgba[0]).toBe(244); // R
    expect(rgba[1]).toBe(67);  // G
    expect(rgba[2]).toBe(54);  // B
  });
});
