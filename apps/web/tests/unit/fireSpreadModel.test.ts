import { describe, it, expect } from 'vitest';
import {
  calculateSpread,
  weightedCircularMean,
  computeEndpoint,
} from '@/lib/fire-spread/model';

describe('calculateSpread', () => {
  it('returns valid output for tree cover (class 10)', () => {
    const result = calculateSpread({
      windSpeed: 15,
      windDirection: 90,
      slope: 10,
      aspect: 180,
      fuelType: 10,
      soilMoisture: 0.3,
    });
    expect(result.direction).toBeGreaterThanOrEqual(0);
    expect(result.direction).toBeLessThan(360);
    expect(result.relativeRate).toBeGreaterThan(0);
    expect(result.relativeRate).toBeLessThanOrEqual(1);
    expect(['low', 'moderate', 'high', 'extreme']).toContain(result.riskLevel);
  });

  it('returns valid output for all standard fuel types', () => {
    const fuelTypes = [10, 20, 30, 40, 50, 60, 80, 90, 95, 100];
    for (const fuelType of fuelTypes) {
      const result = calculateSpread({
        windSpeed: 10,
        windDirection: 180,
        slope: 5,
        aspect: 0,
        fuelType,
        soilMoisture: 0.2,
      });
      expect(result.relativeRate).toBeGreaterThanOrEqual(0);
      expect(result.relativeRate).toBeLessThanOrEqual(1);
    }
  });

  it('water fuel type returns zero spread rate', () => {
    const result = calculateSpread({
      windSpeed: 30,
      windDirection: 0,
      slope: 20,
      aspect: 90,
      fuelType: 80,
      soilMoisture: 0,
    });
    expect(result.relativeRate).toBe(0);
    expect(result.riskLevel).toBe('low');
  });

  it('wind-dominated scenario: high wind → direction follows wind', () => {
    const result = calculateSpread({
      windSpeed: 50, // very strong wind
      windDirection: 45,
      slope: 2, // nearly flat
      aspect: 270,
      fuelType: 30,
      soilMoisture: 0.1,
    });
    // Direction should be close to wind direction (45°)
    const diff = Math.abs(result.direction - 45);
    const wrappedDiff = Math.min(diff, 360 - diff);
    expect(wrappedDiff).toBeLessThan(30);
  });

  it('slope-dominated scenario: steep slope + calm wind → direction follows upslope', () => {
    const result = calculateSpread({
      windSpeed: 1, // very calm
      windDirection: 0,
      slope: 30, // steep
      aspect: 90, // faces east, upslope = west (270°)
      fuelType: 20,
      soilMoisture: 0.2,
    });
    // Fire burns uphill: aspect 90° means slope faces east, upslope direction = 270°
    const upslopeDir = (90 + 180) % 360; // = 270°
    const diff = Math.abs(result.direction - upslopeDir);
    const wrappedDiff = Math.min(diff, 360 - diff);
    expect(wrappedDiff).toBeLessThan(40);
  });

  it('moisture dampening: high moisture → lower spread rate', () => {
    const dry = calculateSpread({
      windSpeed: 15,
      windDirection: 180,
      slope: 10,
      aspect: 0,
      fuelType: 30,
      soilMoisture: 0.0,
    });
    const wet = calculateSpread({
      windSpeed: 15,
      windDirection: 180,
      slope: 10,
      aspect: 0,
      fuelType: 30,
      soilMoisture: 0.9,
    });
    expect(wet.relativeRate).toBeLessThan(dry.relativeRate);
  });

  it('higher wind → higher spread rate', () => {
    const calm = calculateSpread({
      windSpeed: 5,
      windDirection: 0,
      slope: 5,
      aspect: 0,
      fuelType: 30,
      soilMoisture: 0.2,
    });
    const windy = calculateSpread({
      windSpeed: 40,
      windDirection: 0,
      slope: 5,
      aspect: 0,
      fuelType: 30,
      soilMoisture: 0.2,
    });
    expect(windy.relativeRate).toBeGreaterThan(calm.relativeRate);
  });

  it('classifies risk levels correctly', () => {
    // Very low rate scenario
    const low = calculateSpread({
      windSpeed: 2,
      windDirection: 0,
      slope: 1,
      aspect: 0,
      fuelType: 50, // built-up, very low fuel
      soilMoisture: 0.8,
    });
    expect(low.riskLevel).toBe('low');
  });
});

describe('weightedCircularMean', () => {
  it('handles simple average of same angle', () => {
    const result = weightedCircularMean(90, 90, 0.5, 0.5);
    expect(result).toBeCloseTo(90, 0);
  });

  it('handles wraparound: 350° and 10° → ~0°', () => {
    const result = weightedCircularMean(350, 10, 0.5, 0.5);
    // Should be close to 0 (or 360)
    const normalized = result > 180 ? 360 - result : result;
    expect(normalized).toBeLessThan(5);
  });

  it('handles 0° and 180° → depends on weights', () => {
    const result = weightedCircularMean(0, 180, 0.7, 0.3);
    // Should be closer to 0 than 180
    expect(result).toBeLessThan(90);
  });

  it('fully weighted to first angle', () => {
    const result = weightedCircularMean(45, 200, 1.0, 0.0);
    expect(result).toBeCloseTo(45, 0);
  });

  it('handles 270° and 90° with equal weights → ambiguous but valid', () => {
    const result = weightedCircularMean(270, 90, 0.5, 0.5);
    // Could be 0° or 180° (ambiguous opposite directions)
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });
});

describe('computeEndpoint', () => {
  it('returns a point at approximately the right distance', () => {
    const [endLon, endLat] = computeEndpoint(-5.1, 33.5, 0, 1);
    // Bearing 0 (north): lat should increase, lon stay same
    expect(endLat).toBeGreaterThan(33.5);
    expect(endLon).toBeCloseTo(-5.1, 2);

    // Check distance (~1km northward ≈ 0.009° of latitude)
    const dLat = endLat - 33.5;
    expect(dLat).toBeCloseTo(0.009, 2);
  });

  it('bearing 90° (east) → longitude increases', () => {
    const [endLon, endLat] = computeEndpoint(-5.1, 33.5, 90, 1);
    expect(endLon).toBeGreaterThan(-5.1);
    expect(endLat).toBeCloseTo(33.5, 2);
  });

  it('bearing 180° (south) → latitude decreases', () => {
    const [endLon, endLat] = computeEndpoint(-5.1, 33.5, 180, 1);
    expect(endLat).toBeLessThan(33.5);
    expect(endLon).toBeCloseTo(-5.1, 2);
  });

  it('zero distance returns same point', () => {
    const [endLon, endLat] = computeEndpoint(-5.1, 33.5, 45, 0);
    expect(endLon).toBeCloseTo(-5.1, 5);
    expect(endLat).toBeCloseTo(33.5, 5);
  });
});
