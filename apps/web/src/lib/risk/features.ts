/**
 * Maps live app data (weather aggregates + date) into the wildfire model's
 * exact feature vector — same names, order, units and transformations as
 * `gpu_training_bundle_v1_3_0`'s `n1_r1_modeling_contract_v1_2_0.json` used
 * for the chosen run (see `model/MODEL_CARD.md`).
 */

import { loadModel, type FeatureValue, type FeatureVector } from '@/lib/risk/xgboost';

/** Past-24h weather aggregates, in the exact units the model was trained on. */
export interface WeatherAggregates24h {
  /** °C, mean of the last 24 hourly readings. */
  temperatureMeanC: number | null | undefined;
  /** °C, min of the last 24 hourly readings. */
  temperatureMinC: number | null | undefined;
  /** °C, max of the last 24 hourly readings. */
  temperatureMaxC: number | null | undefined;
  /** %, mean relative humidity over the last 24 hourly readings. */
  relativeHumidityMeanPct: number | null | undefined;
  /** km/h, mean wind speed over the last 24 hourly readings. */
  windSpeedMeanKmh: number | null | undefined;
  /** mm, summed precipitation over the last 24 hourly readings. */
  precipitationSumMm: number | null | undefined;
  /** MJ/m², summed shortwave radiation ("solar energy") over the last 24 hourly readings. */
  solarEnergySumMjm2: number | null | undefined;
}

export interface BuildFeatureVectorInputs {
  /** The date/time the prediction is for (drives seasonal features). */
  at: Date;
  weather: WeatherAggregates24h;
  /**
   * MODIS NDVI (last valid, causal). No live per-point source exists in the
   * app today (`/api/ndvi` only serves a map tile, not a pixel value) — omit
   * it to fall through to `missing`. Accepted here for forward-compatibility
   * if a live source is added later.
   */
  ndvi?: number | null;
  /**
   * `province_adm2` category. Defaults to `"Ifrane"` because the app only
   * ever serves points inside Ifrane Province — see `riskService.ts`'s
   * domain check, which rejects points outside the training geography
   * before this is used.
   */
  province?: 'El Hajeb' | 'Ifrane' | 'Sefrou';
}

export interface BuildFeatureVectorResult {
  vector: FeatureVector;
  /** Feature names (model order) whose value is missing (null/undefined/NaN). */
  missing: string[];
}

/**
 * Features the model can be evaluated without: XGBoost routes missing values
 * via each split's learned `default_left`, and training data shows this
 * feature is almost never missing (`feature_quality.csv`: 2 of 32,476 rows).
 * It nonetheless carries real signal (2nd-highest gain of 11 features), so a
 * missing NDVI degrades — but does not invalidate — a prediction.
 */
const TOLERATED_MISSING_FEATURES = new Set(['causal_modis_ndvi_last_valid_6c']);

/** Feature names that make the prediction meaningless if absent. */
export function requiredFeatureNames(): string[] {
  return loadModel().featureNames.filter((name) => !TOLERATED_MISSING_FEATURES.has(name));
}

function dayOfYearUtc(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const startOfDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((startOfDay - startOfYear) / 86_400_000) + 1;
}

function isBlank(value: FeatureValue): boolean {
  return value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value));
}

/**
 * Builds the feature vector for the model in its exact trained order/units.
 * Never throws: unavailable inputs simply show up in `missing`, and it is
 * the caller's (`riskService.ts`) job to decide whether that makes the
 * prediction `unavailable`.
 */
export function buildFeatureVector(inputs: BuildFeatureVectorInputs): BuildFeatureVectorResult {
  const model = loadModel();
  const { weather } = inputs;
  const province = inputs.province ?? 'Ifrane';

  const byName: Record<string, FeatureValue> = {
    month_index: inputs.at.getUTCMonth() + 1,
    day_of_year: dayOfYearUtc(inputs.at),
    province_adm2: province,
    causal_temperature_mean_past24h_c: weather.temperatureMeanC ?? null,
    causal_relative_humidity_mean_past24h_pct: weather.relativeHumidityMeanPct ?? null,
    causal_wind_speed_mean_past24h_kmh: weather.windSpeedMeanKmh ?? null,
    causal_precipitation_sum_past24h_mm: weather.precipitationSumMm ?? null,
    causal_temperature_max_past24h_c: weather.temperatureMaxC ?? null,
    causal_temperature_min_past24h_c: weather.temperatureMinC ?? null,
    causal_solar_energy_sum_past24h_mjm2: weather.solarEnergySumMjm2 ?? null,
    causal_modis_ndvi_last_valid_6c: inputs.ndvi ?? null,
  };

  const vector: FeatureVector = {};
  const missing: string[] = [];
  for (const name of model.featureNames) {
    const value = byName[name];
    vector[name] = value;
    if (isBlank(value)) missing.push(name);
  }

  return { vector, missing };
}
