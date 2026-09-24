/**
 * Wildfire-risk assessment for a point, combining live Open-Meteo weather
 * with the partner team's XGBoost model (`xgboost.ts` + `model/model.json`).
 *
 * See `model/MODEL_CARD.md` for the model's identity, chosen run, metrics,
 * risk-level thresholds and limitations.
 */

import { loadModel, predictProbability, type FeatureVector } from '@/lib/risk/xgboost';
import { buildFeatureVector, requiredFeatureNames, type WeatherAggregates24h } from '@/lib/risk/features';
import { logger } from '@/lib/observability/logger';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'very_high';
export type RiskStatus = 'ok' | 'unavailable';
export type UnavailableReason = 'outside_model_domain' | 'weather_unavailable' | 'missing_required_features';

export interface HeuristicFallback {
  label: 'heuristic';
  /** 0..1, same scale as the model's `score` so the UI can treat them uniformly. */
  score: number;
  level: RiskLevel;
  note: string;
}

export interface RiskAssessment {
  status: RiskStatus;
  /** Model probability of fire occurrence, 0..1. `null` when `status` is `unavailable`. */
  score: number | null;
  level: RiskLevel | null;
  modelId: string;
  modelVersion: string;
  /** ISO timestamp of the most recent weather hour used, or `null` if none was fetched. */
  dataTime: string | null;
  /** The feature vector actually used (or attempted), keyed by model feature name. */
  inputs: FeatureVector | null;
  /** Model feature names whose value was missing. */
  missing: string[];
  reason?: UnavailableReason;
  fallback?: HeuristicFallback;
}

export interface AssessRiskParams {
  lat: number;
  lng: number;
  /** Defaults to now. */
  at?: Date | string;
}

/**
 * Bounding box approximating the model's training geography (Ifrane, Sefrou
 * and El Hajeb provinces — see MODEL_CARD.md). There is no exact polygon
 * available in the training bundle, so this rectangle (also used by
 * `/api/risk/grid`) is the best available proxy; it comfortably contains
 * Ifrane Province while excluding most of the rest of Morocco.
 */
export const MODEL_DOMAIN_BBOX = { minLat: 33.1, maxLat: 33.8, minLng: -5.6, maxLng: -4.6 } as const;

export function isInsideModelDomain(lat: number, lng: number): boolean {
  return (
    lat >= MODEL_DOMAIN_BBOX.minLat &&
    lat <= MODEL_DOMAIN_BBOX.maxLat &&
    lng >= MODEL_DOMAIN_BBOX.minLng &&
    lng <= MODEL_DOMAIN_BBOX.maxLng
  );
}

/** Risk-level thresholds — see MODEL_CARD.md "Risk-level thresholds" for the rationale. */
export function levelFromScore(score: number): RiskLevel {
  if (score >= 0.75) return 'very_high';
  if (score >= 0.5) return 'high';
  if (score >= 0.0952) return 'moderate';
  return 'low';
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}

export interface OpenMeteoHourly {
  time: string[];
  temperature_2m: (number | null)[];
  relative_humidity_2m: (number | null)[];
  wind_speed_10m: (number | null)[];
  precipitation: (number | null)[];
  shortwave_radiation: (number | null)[];
}

export function isOpenMeteoHourly(value: unknown): value is OpenMeteoHourly {
  if (!value || typeof value !== 'object') return false;
  const h = value as Record<string, unknown>;
  return (
    Array.isArray(h.time) &&
    Array.isArray(h.temperature_2m) &&
    Array.isArray(h.relative_humidity_2m) &&
    Array.isArray(h.wind_speed_10m) &&
    Array.isArray(h.precipitation) &&
    Array.isArray(h.shortwave_radiation)
  );
}

/**
 * Aggregates an Open-Meteo hourly response into the causal past-24h
 * features the model expects, ending at the latest hour at or before `at`.
 * Shared by the single-point fetch below and the grid route's batched
 * multi-coordinate fetch, so both compute aggregates identically.
 */
export function aggregateHourlyWeather(
  hourly: OpenMeteoHourly,
  at: Date
): { weather: WeatherAggregates24h; dataTime: string } | null {
  const atMs = at.getTime();
  let endIdx = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = Date.parse(`${hourly.time[i]}Z`);
    if (!Number.isNaN(t) && t <= atMs) endIdx = i;
  }
  if (endIdx === -1) endIdx = hourly.time.length - 1;
  if (endIdx < 0) return null;
  const startIdx = Math.max(0, endIdx - 23);

  const slice = (arr: (number | null)[]) =>
    arr.slice(startIdx, endIdx + 1).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const temps = slice(hourly.temperature_2m);
  const humidity = slice(hourly.relative_humidity_2m);
  const wind = slice(hourly.wind_speed_10m);
  const precip = slice(hourly.precipitation);
  // Open-Meteo reports shortwave_radiation as an instantaneous W/m² average
  // for each hour; summing 24 hourly W/m² values approximates Wh/m², which
  // we convert to MJ/m² (1 Wh = 3.6e-3 MJ) to match the model's trained unit.
  const radiation = slice(hourly.shortwave_radiation);
  const radiationSumMjm2 = sum(radiation);

  const weather: WeatherAggregates24h = {
    temperatureMeanC: mean(temps),
    temperatureMinC: temps.length ? Math.min(...temps) : null,
    temperatureMaxC: temps.length ? Math.max(...temps) : null,
    relativeHumidityMeanPct: mean(humidity),
    windSpeedMeanKmh: mean(wind),
    precipitationSumMm: sum(precip),
    solarEnergySumMjm2: radiationSumMjm2 === null ? null : radiationSumMjm2 * 0.0036,
  };

  return { weather, dataTime: `${hourly.time[endIdx]}Z` };
}

/**
 * Fetches the last 24 hourly readings up to (and including) `at` from
 * Open-Meteo and aggregates them into the causal past-24h features the
 * model expects. Returns `null` on any fetch/parse failure — callers treat
 * that as "no weather data available" rather than throwing, so a transient
 * upstream failure degrades gracefully to `status: 'unavailable'` plus a
 * heuristic fallback rather than a 5xx.
 */
export async function fetchWeatherAggregates(
  lat: number,
  lng: number,
  at: Date
): Promise<{ weather: WeatherAggregates24h; dataTime: string } | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,shortwave_radiation` +
    `&past_days=2&forecast_days=1&timezone=UTC`;

  try {
    const response = await fetch(url, { next: { revalidate: 900 } });
    if (!response.ok) {
      logger.warn({ event: 'risk_weather_fetch_failed', meta: { lat, lng, status: response.status } });
      return null;
    }
    const data: unknown = await response.json();
    const hourly = (data as { hourly?: unknown })?.hourly;
    if (!isOpenMeteoHourly(hourly)) {
      logger.warn({ event: 'risk_weather_invalid_response', meta: { lat, lng } });
      return null;
    }

    return aggregateHourlyWeather(hourly, at);
  } catch (error) {
    logger.warn({ event: 'risk_weather_fetch_error', meta: { lat, lng, error: String(error) } });
    return null;
  }
}

/**
 * A simple weather-only heuristic used only when the model prediction is
 * `unavailable`. `priorityScore.ts`'s `computeIncidentPriority` requires an
 * existing incident (severity/status), which doesn't fit a bare
 * location-based assessment, so this mirrors its FWI-proxy weighting
 * (temperature 35% / dryness 35% / wind 30%, min-max normalized) without
 * the incident-severity component. This is explicitly a rough heuristic,
 * not a model prediction — callers must label it as such.
 */
export function computeHeuristicFallback(weather: WeatherAggregates24h): HeuristicFallback {
  const temp = weather.temperatureMaxC ?? weather.temperatureMeanC ?? 20;
  const humidity = weather.relativeHumidityMeanPct ?? 50;
  const wind = weather.windSpeedMeanKmh ?? 10;

  const tempNorm = Math.min(Math.max(temp, 0), 40) / 40;
  const dryNorm = 1 - Math.min(Math.max(humidity, 0), 100) / 100;
  const windNorm = Math.min(Math.max(wind, 0), 50) / 50;

  const score = tempNorm * 0.35 + dryNorm * 0.35 + windNorm * 0.3;
  return {
    label: 'heuristic',
    score,
    level: levelFromScore(score),
    note: 'Model prediction unavailable — this is a simple weather-only heuristic (temperature/humidity/wind), not the ML model.',
  };
}

/**
 * Assesses wildfire-occurrence risk for a point.
 *
 * Returns `status: 'unavailable'` (with `reason`) when the point is outside
 * the model's training geography, when live weather couldn't be fetched, or
 * when a feature the model can't tolerate missing (any weather input other
 * than NDVI, which the model already treats as commonly missing) is absent.
 * In every `unavailable` case where weather data *was* obtained, a labelled
 * `fallback` heuristic score is included.
 */
export async function assessRisk(params: AssessRiskParams): Promise<RiskAssessment> {
  const { lat, lng } = params;
  const at = params.at ? new Date(params.at) : new Date();
  const model = loadModel();

  const weatherResult = await fetchWeatherAggregates(lat, lng, at);
  const fallback = weatherResult ? computeHeuristicFallback(weatherResult.weather) : undefined;

  if (!isInsideModelDomain(lat, lng)) {
    return {
      status: 'unavailable',
      score: null,
      level: null,
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      dataTime: weatherResult?.dataTime ?? null,
      inputs: null,
      missing: [],
      reason: 'outside_model_domain',
      fallback,
    };
  }

  if (!weatherResult) {
    return {
      status: 'unavailable',
      score: null,
      level: null,
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      dataTime: null,
      inputs: null,
      missing: [],
      reason: 'weather_unavailable',
    };
  }

  const { vector, missing } = buildFeatureVector({ at, weather: weatherResult.weather });
  const required = new Set(requiredFeatureNames());
  const missingRequired = missing.filter((name) => required.has(name));

  if (missingRequired.length > 0) {
    return {
      status: 'unavailable',
      score: null,
      level: null,
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      dataTime: weatherResult.dataTime,
      inputs: vector,
      missing,
      reason: 'missing_required_features',
      fallback,
    };
  }

  const score = predictProbability(vector, model);
  const level = levelFromScore(score);

  return {
    status: 'ok',
    score,
    level,
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    dataTime: weatherResult.dataTime,
    inputs: vector,
    missing,
  };
}
