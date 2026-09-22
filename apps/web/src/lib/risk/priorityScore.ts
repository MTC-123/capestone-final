/**
 * Incident priority scoring utility.
 *
 * Score range: 0–100.
 * Weights:
 *  - Severity (1–5 scale):  50 pts
 *  - FWI proxy (wind+temp+dryness): 30 pts
 *  - Resource proximity proxy:      20 pts (reserved; uses 0 when no data)
 */

export interface IncidentForScoring {
  severity: number; // 1–5
  status: string;
}

export interface WeatherForScoring {
  temperature: number; // °C
  windSpeed: number;   // km/h
  humidity?: number;   // % (0–100)
}

/**
 * Compute a 0–100 priority score for an incident.
 */
export function computeIncidentPriority(
  incident: IncidentForScoring,
  weather: WeatherForScoring | null
): number {
  // 1. Severity component (50 pts max)
  const severityPts = ((incident.severity - 1) / 4) * 50;

  // 2. FWI proxy (30 pts max)
  let fwiPts = 0;
  if (weather) {
    const tempNorm = Math.min(weather.temperature, 40) / 40;
    const humidity = weather.humidity ?? 50;
    const dryNorm = 1 - Math.min(humidity, 100) / 100;
    const windNorm = Math.min(weather.windSpeed, 50) / 50;
    const fwiScore = tempNorm * 0.35 + dryNorm * 0.35 + windNorm * 0.30;
    fwiPts = fwiScore * 30;
  }

  // 3. Proximity bonus (20 pts max) — reserved for future resource proximity calc
  const proximityPts = 0;

  return Math.round(Math.min(100, severityPts + fwiPts + proximityPts));
}

/**
 * Returns a human-readable priority label.
 */
export function getPriorityLabel(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
