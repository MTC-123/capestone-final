import type { WeatherData } from '@/types';

export type RiskLevel5 = 'tresFaible' | 'faible' | 'moyen' | 'eleve' | 'extreme';

export interface RiskInfo {
  level: RiskLevel5;
  score: number;
  color: string;
  labelKey: string;
}

const RISK_THRESHOLDS: { min: number; level: RiskLevel5; color: string; labelKey: string }[] = [
  { min: 0.8, level: 'extreme', color: '#991b1b', labelKey: 'riskExtreme' },
  { min: 0.6, level: 'eleve', color: '#ef4444', labelKey: 'riskHigh' },
  { min: 0.4, level: 'moyen', color: '#f59e0b', labelKey: 'riskModerate' },
  { min: 0.2, level: 'faible', color: '#84cc16', labelKey: 'riskLow' },
  { min: 0, level: 'tresFaible', color: '#22c55e', labelKey: 'riskVeryLow' },
];

/**
 * Normalized FWI proxy score in [0, 1].
 * Weights: temperature 35%, dryness (1-humidity) 35%, wind 30%.
 * Ceilings: temp 40C, wind 50 km/h, humidity 0-100%.
 */
export function getRiskScore(weather: WeatherData): number {
  const tempNorm = Math.min(weather.temperature, 40) / 40;
  const humidity = weather.humidity ?? 50;
  const dryNorm = 1 - Math.min(humidity, 100) / 100;
  const windNorm = Math.min(weather.windSpeed, 50) / 50;
  return tempNorm * 0.35 + dryNorm * 0.35 + windNorm * 0.30;
}

export function getRiskInfo(weather: WeatherData | null): RiskInfo | null {
  if (!weather) return null;
  const score = getRiskScore(weather);
  const match = RISK_THRESHOLDS.find((t) => score >= t.min) ?? RISK_THRESHOLDS[RISK_THRESHOLDS.length - 1];
  return { level: match.level, score, color: match.color, labelKey: match.labelKey };
}

/** Badge tone for UI components */
export function getRiskTone(level: RiskLevel5): 'success' | 'warning' | 'danger' {
  if (level === 'extreme' || level === 'eleve') return 'danger';
  if (level === 'moyen') return 'warning';
  return 'success';
}
