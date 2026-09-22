export type DateRangePreset = '7d' | '30d' | 'season' | 'year' | 'custom' | 'all';

export type AnalyticsTab = 'overview' | 'temporal' | 'causes' | 'response' | 'environment' | 'rex';

export interface EnhancedAnalyticsData {
  timeline: { date: string; count: number }[];
  causes: { cause: string; count: number }[];
  hourly: { hour: number; count: number }[];
  severity: { level: number; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  stats: {
    totalIncidents: number;
    daysWithFires: number;
    dailyAverage: string;
    peakHour: number;
    mostCommonCause: string;
    avgSeverity: string;
  };
  dateRange: { from: string; to: string };
}

export interface TemporalData {
  byDate: { date: string; count: number }[];
  byHour: { hour: number; count: number }[];
  monthlyHeatmap: { year: number; month: number; count: number }[];
}

export interface ResponsePhase {
  name: string;
  avgMinutes: number;
}

export interface ResponseData {
  phases: ResponsePhase[];
  avgTotalMinutes: number;
  records: {
    id: string;
    burnAreaHa: number | null;
    totalMinutes: number;
    alertSource: string;
  }[];
}

export interface RexData {
  totalVehicles: number;
  totalAircraft: number;
  totalPersonnel: number;
  totalWaterLiters: number;
  totalRetardantLiters: number;
  economicLoss: {
    forest: number;
    infrastructure: number;
    agriculture: number;
    total: number;
  };
  burnAreaStats: {
    avg: number;
    max: number;
    total: number;
  };
  recordCount: number;
}

export interface WeatherHistoryData {
  dates: string[];
  temperatureMax: (number | null)[];
  precipitation: (number | null)[];
  humidityMean: (number | null)[];
  windSpeedMax: (number | null)[];
}

export interface PrecipitationStats {
  rainfall30d: number;
  daysSinceRain: number;
  deficitPercent: number;
  totalPrecipitation90d: number;
}

export interface PrecipitationData {
  dates: string[];
  precipitation: number[];
  rain: number[];
  snowfall: number[];
  cumulative: number[];
  stats: PrecipitationStats;
}
