import { describe, expect, it } from 'vitest';
import { buildFeatureVector, requiredFeatureNames } from '@/lib/risk/features';
import { loadModel } from '@/lib/risk/xgboost';

const FULL_WEATHER = {
  temperatureMeanC: 22.5,
  temperatureMinC: 15.1,
  temperatureMaxC: 30.2,
  relativeHumidityMeanPct: 45.3,
  windSpeedMeanKmh: 12.4,
  precipitationSumMm: 0.4,
  solarEnergySumMjm2: 21.7,
};

describe('buildFeatureVector', () => {
  it('produces exactly the model feature names, in the model order', () => {
    const model = loadModel();
    const { vector } = buildFeatureVector({ at: new Date('2026-07-15T12:00:00Z'), weather: FULL_WEATHER });
    expect(Object.keys(vector)).toEqual(model.featureNames);
  });

  it('maps calendar date to month_index and day_of_year in the trained units', () => {
    const { vector } = buildFeatureVector({ at: new Date('2026-03-05T08:00:00Z'), weather: FULL_WEATHER });
    expect(vector.month_index).toBe(3);
    // Jan (31) + Feb (28, 2026 not a leap year) + 5 = 64
    expect(vector.day_of_year).toBe(64);
  });

  it('computes day_of_year correctly across a leap year', () => {
    const { vector } = buildFeatureVector({ at: new Date('2028-03-01T00:00:00Z'), weather: FULL_WEATHER });
    // Jan (31) + Feb (29, 2028 is a leap year) + 1 = 61
    expect(vector.day_of_year).toBe(61);
  });

  it('defaults province_adm2 to "Ifrane"', () => {
    const { vector } = buildFeatureVector({ at: new Date('2026-01-01'), weather: FULL_WEATHER });
    expect(vector.province_adm2).toBe('Ifrane');
  });

  it('passes weather aggregates through with the exact model units (°C, %, km/h, mm, MJ/m²)', () => {
    const { vector } = buildFeatureVector({ at: new Date('2026-01-01'), weather: FULL_WEATHER });
    expect(vector.causal_temperature_mean_past24h_c).toBe(22.5);
    expect(vector.causal_temperature_min_past24h_c).toBe(15.1);
    expect(vector.causal_temperature_max_past24h_c).toBe(30.2);
    expect(vector.causal_relative_humidity_mean_past24h_pct).toBe(45.3);
    expect(vector.causal_wind_speed_mean_past24h_kmh).toBe(12.4);
    expect(vector.causal_precipitation_sum_past24h_mm).toBe(0.4);
    expect(vector.causal_solar_energy_sum_past24h_mjm2).toBe(21.7);
  });

  it('reports no missing features when weather and ndvi are all present', () => {
    const { missing } = buildFeatureVector({ at: new Date('2026-01-01'), weather: FULL_WEATHER, ndvi: 0.4 });
    expect(missing).toEqual([]);
  });

  it('reports causal_modis_ndvi_last_valid_6c as missing when ndvi is omitted', () => {
    const { missing, vector } = buildFeatureVector({ at: new Date('2026-01-01'), weather: FULL_WEATHER });
    expect(missing).toEqual(['causal_modis_ndvi_last_valid_6c']);
    expect(vector.causal_modis_ndvi_last_valid_6c).toBeNull();
  });

  it('reports every absent weather field as missing', () => {
    const { missing } = buildFeatureVector({
      at: new Date('2026-01-01'),
      weather: { ...FULL_WEATHER, temperatureMeanC: null, windSpeedMeanKmh: undefined },
    });
    expect(missing).toEqual(
      expect.arrayContaining(['causal_temperature_mean_past24h_c', 'causal_wind_speed_mean_past24h_kmh'])
    );
  });

  it('requiredFeatureNames excludes NDVI and includes every weather feature', () => {
    const required = requiredFeatureNames();
    expect(required).not.toContain('causal_modis_ndvi_last_valid_6c');
    expect(required).toEqual(
      expect.arrayContaining([
        'month_index',
        'day_of_year',
        'province_adm2',
        'causal_temperature_mean_past24h_c',
        'causal_relative_humidity_mean_past24h_pct',
        'causal_wind_speed_mean_past24h_kmh',
        'causal_precipitation_sum_past24h_mm',
        'causal_temperature_max_past24h_c',
        'causal_temperature_min_past24h_c',
        'causal_solar_energy_sum_past24h_mjm2',
      ])
    );
  });
});
