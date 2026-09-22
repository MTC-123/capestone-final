import { describe, it, expect } from 'vitest';
import { getRiskScore, getRiskInfo, getRiskTone } from '@/lib/map/riskLevel';
import type { WeatherData } from '@/types';

function makeWeather(overrides: Partial<WeatherData> = {}): WeatherData {
  return {
    temperature: 20,
    windSpeed: 10,
    windDirection: 180,
    timestamp: '2025-01-01T12:00:00Z',
    ...overrides,
  };
}

describe('getRiskScore', () => {
  it('returns 0 for zero temperature, zero wind, 100% humidity', () => {
    const score = getRiskScore(makeWeather({ temperature: 0, windSpeed: 0, humidity: 100 }));
    expect(score).toBeCloseTo(0, 5);
  });

  it('returns 1 for max temperature (40+), zero humidity, max wind (50+)', () => {
    const score = getRiskScore(makeWeather({ temperature: 40, windSpeed: 50, humidity: 0 }));
    expect(score).toBeCloseTo(1, 5);
  });

  it('clamps temperature at 40', () => {
    const s1 = getRiskScore(makeWeather({ temperature: 40, humidity: 50, windSpeed: 0 }));
    const s2 = getRiskScore(makeWeather({ temperature: 60, humidity: 50, windSpeed: 0 }));
    expect(s1).toBeCloseTo(s2, 5);
  });

  it('clamps wind at 50', () => {
    const s1 = getRiskScore(makeWeather({ temperature: 0, humidity: 100, windSpeed: 50 }));
    const s2 = getRiskScore(makeWeather({ temperature: 0, humidity: 100, windSpeed: 100 }));
    expect(s1).toBeCloseTo(s2, 5);
  });

  it('clamps humidity at 100', () => {
    const s1 = getRiskScore(makeWeather({ temperature: 0, windSpeed: 0, humidity: 100 }));
    const s2 = getRiskScore(makeWeather({ temperature: 0, windSpeed: 0, humidity: 200 }));
    expect(s1).toBeCloseTo(s2, 5);
  });

  it('defaults humidity to 50 when not provided', () => {
    const withDefault = getRiskScore(makeWeather({ temperature: 20, windSpeed: 10, humidity: undefined }));
    const withExplicit = getRiskScore(makeWeather({ temperature: 20, windSpeed: 10, humidity: 50 }));
    expect(withDefault).toBeCloseTo(withExplicit, 5);
  });

  it('computes correct weighted score for known inputs', () => {
    // temp=20 -> 20/40=0.5, humidity=50 -> dry=0.5, wind=25 -> 25/50=0.5
    // score = 0.5*0.35 + 0.5*0.35 + 0.5*0.30 = 0.175 + 0.175 + 0.15 = 0.5
    const score = getRiskScore(makeWeather({ temperature: 20, windSpeed: 25, humidity: 50 }));
    expect(score).toBeCloseTo(0.5, 5);
  });

  it('returns a value in [0, 1]', () => {
    const samples = [
      makeWeather({ temperature: 0, windSpeed: 0, humidity: 100 }),
      makeWeather({ temperature: 40, windSpeed: 50, humidity: 0 }),
      makeWeather({ temperature: 25, windSpeed: 15, humidity: 60 }),
    ];
    for (const w of samples) {
      const score = getRiskScore(w);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe('getRiskInfo', () => {
  it('returns null when weather is null', () => {
    expect(getRiskInfo(null)).toBeNull();
  });

  it('returns extreme for very high risk (score >= 0.8)', () => {
    const weather = makeWeather({ temperature: 40, windSpeed: 50, humidity: 0 });
    const info = getRiskInfo(weather)!;
    expect(info.level).toBe('extreme');
    expect(info.color).toBe('#991b1b');
    expect(info.labelKey).toBe('riskExtreme');
    expect(info.score).toBeCloseTo(1, 5);
  });

  it('returns eleve for high risk (score >= 0.6)', () => {
    // temp=30 -> 0.75, humidity=20 -> dry=0.8, wind=15 -> 0.3
    // 0.75*0.35 + 0.8*0.35 + 0.3*0.30 = 0.2625 + 0.28 + 0.09 = 0.6325
    const weather = makeWeather({ temperature: 30, windSpeed: 15, humidity: 20 });
    const info = getRiskInfo(weather)!;
    expect(info.level).toBe('eleve');
  });

  it('returns moyen for moderate risk (score >= 0.4)', () => {
    // temp=20 -> 0.5, humidity=50 -> dry=0.5, wind=10 -> 0.2
    // 0.5*0.35 + 0.5*0.35 + 0.2*0.30 = 0.175 + 0.175 + 0.06 = 0.41
    const weather = makeWeather({ temperature: 20, windSpeed: 10, humidity: 50 });
    const info = getRiskInfo(weather)!;
    expect(info.level).toBe('moyen');
  });

  it('returns faible for low risk (score >= 0.2)', () => {
    // temp=10 -> 0.25, humidity=70 -> dry=0.3, wind=5 -> 0.1
    // 0.25*0.35 + 0.3*0.35 + 0.1*0.30 = 0.0875 + 0.105 + 0.03 = 0.2225
    const weather = makeWeather({ temperature: 10, windSpeed: 5, humidity: 70 });
    const info = getRiskInfo(weather)!;
    expect(info.level).toBe('faible');
  });

  it('returns tresFaible for very low risk (score < 0.2)', () => {
    const weather = makeWeather({ temperature: 0, windSpeed: 0, humidity: 100 });
    const info = getRiskInfo(weather)!;
    expect(info.level).toBe('tresFaible');
    expect(info.color).toBe('#22c55e');
    expect(info.labelKey).toBe('riskVeryLow');
  });

  it('includes score in the returned object', () => {
    const weather = makeWeather({ temperature: 20, windSpeed: 10, humidity: 50 });
    const info = getRiskInfo(weather)!;
    expect(typeof info.score).toBe('number');
    expect(info.score).toBeGreaterThanOrEqual(0);
    expect(info.score).toBeLessThanOrEqual(1);
  });

  it('returns correct shape with all fields', () => {
    const weather = makeWeather();
    const info = getRiskInfo(weather)!;
    expect(info).toHaveProperty('level');
    expect(info).toHaveProperty('score');
    expect(info).toHaveProperty('color');
    expect(info).toHaveProperty('labelKey');
  });
});

describe('getRiskTone', () => {
  it('returns "danger" for extreme', () => {
    expect(getRiskTone('extreme')).toBe('danger');
  });

  it('returns "danger" for eleve', () => {
    expect(getRiskTone('eleve')).toBe('danger');
  });

  it('returns "warning" for moyen', () => {
    expect(getRiskTone('moyen')).toBe('warning');
  });

  it('returns "success" for faible', () => {
    expect(getRiskTone('faible')).toBe('success');
  });

  it('returns "success" for tresFaible', () => {
    expect(getRiskTone('tresFaible')).toBe('success');
  });
});
