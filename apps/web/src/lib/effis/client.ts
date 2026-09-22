import { getCircuitBreaker } from '@/lib/platform/circuitBreaker';
import { logRetryAttempt } from '@/lib/errors/context';
import { AppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/observability/logger';

/**
 * EFFIS WFS endpoint for VIIRS hotspots
 * Open data — no API key required
 */
const EFFIS_WFS_BASE = 'https://maps.effis.emergency.copernicus.eu/effis';

const EFFIS_CONFIG = {
  /** Circuit breaker ID for EFFIS service */
  breakerId: 'effis-wfs',
  /** Request timeout in ms */
  timeoutMs: 15_000,
  /** Retry backoff in ms */
  retryBackoffMs: 1000,
  /** Max retry attempts */
  maxAttempts: 2,
  /** WFS layer name for VIIRS active fires */
  typeName: 'viirs.hs',
} as const;

/** Transient HTTP status codes that warrant retry */
const TRANSIENT_STATUS_CODES = [502, 503, 504];

/**
 * Middle Atlas bounding box (broader than FIRMS Ifrane bbox)
 * Covers the region around Ifrane for fire detection
 */
export const MIDDLE_ATLAS_BBOX = '32.5,-6.0,34.0,-4.5,EPSG:4326';

export type FetchEffisOptions = {
  bbox?: string;
  timeoutMs?: number;
};

export type FetchEffisResult = {
  geojson: unknown;
  durationMs: number;
  attemptsMade: number;
};

function buildWfsUrl(bbox: string): string {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: EFFIS_CONFIG.typeName,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    bbox,
  });
  return `${EFFIS_WFS_BASE}?${params.toString()}`;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: { 'User-Agent': 'RICER-Fire-Platform/2.1 (Ifrane-Morocco)' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isTransientError(status: number): boolean {
  return TRANSIENT_STATUS_CODES.includes(status);
}

/**
 * Fetch EFFIS VIIRS hotspots via WFS.
 * Uses circuit breaker + retry with exponential backoff (mirrors FIRMS client pattern).
 */
export async function fetchEffisDetections(options: FetchEffisOptions = {}): Promise<FetchEffisResult> {
  const bbox = options.bbox ?? MIDDLE_ATLAS_BBOX;
  const timeoutMs = options.timeoutMs ?? EFFIS_CONFIG.timeoutMs;
  const breaker = getCircuitBreaker(EFFIS_CONFIG.breakerId);

  if (!breaker.canRequest()) {
    logger.info({
      event: 'effis_endpoint_skipped',
      meta: { reason: 'circuit_breaker_open' },
    });
    throw new AppError(4003, {
      message: 'EFFIS service circuit breaker open',
      meta: { reason: 'circuit_breaker_open' },
    });
  }

  const apiUrl = buildWfsUrl(bbox);
  const startedAt = performance.now();
  let totalAttempts = 0;

  for (let attempt = 1; attempt <= EFFIS_CONFIG.maxAttempts; attempt++) {
    totalAttempts++;

    try {
      const response = await fetchWithTimeout(apiUrl, timeoutMs);

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');

        if (isTransientError(response.status) && attempt < EFFIS_CONFIG.maxAttempts) {
          logRetryAttempt({
            operation: 'effis_wfs_fetch',
            attempt,
            maxAttempts: EFFIS_CONFIG.maxAttempts,
            cumulativeDurationMs: performance.now() - startedAt,
            lastError: `HTTP ${response.status}`,
            classification: 'network',
          });
          await new Promise((resolve) => setTimeout(resolve, EFFIS_CONFIG.retryBackoffMs));
          continue;
        }

        breaker.onFailure();
        throw new AppError(4003, {
          message: `EFFIS WFS returned HTTP ${response.status}: ${bodyText.slice(0, 100)}`,
          meta: { status: response.status, attempts: attempt },
        });
      }

      // Parse JSON response
      const geojson = await response.json();
      breaker.onSuccess();
      const durationMs = performance.now() - startedAt;

      logger.info({
        event: 'effis_fetch_success',
        meta: { durationMs: Math.round(durationMs), attempt, bbox },
      });

      return { geojson, durationMs, attemptsMade: totalAttempts };
    } catch (error) {
      if (error instanceof AppError) throw error;

      const durationMs = performance.now() - startedAt;

      // Timeout
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < EFFIS_CONFIG.maxAttempts) {
          logRetryAttempt({
            operation: 'effis_wfs_fetch',
            attempt,
            maxAttempts: EFFIS_CONFIG.maxAttempts,
            cumulativeDurationMs: durationMs,
            lastError: 'timeout',
            classification: 'timeout',
          });
          await new Promise((resolve) => setTimeout(resolve, EFFIS_CONFIG.retryBackoffMs));
          continue;
        }

        breaker.onFailure();
        throw new AppError(4003, {
          message: `EFFIS WFS timeout after ${timeoutMs}ms`,
          meta: { timeoutMs, attempts: attempt },
        });
      }

      // Network error
      if (attempt < EFFIS_CONFIG.maxAttempts) {
        logRetryAttempt({
          operation: 'effis_wfs_fetch',
          attempt,
          maxAttempts: EFFIS_CONFIG.maxAttempts,
          cumulativeDurationMs: durationMs,
          lastError: (error as Error)?.message ?? 'unknown',
          classification: 'network',
        });
        await new Promise((resolve) => setTimeout(resolve, EFFIS_CONFIG.retryBackoffMs));
        continue;
      }

      breaker.onFailure();
      throw new AppError(4003, {
        message: `EFFIS WFS fetch failed: ${(error as Error)?.message ?? 'unknown'}`,
        meta: { attempts: attempt },
      });
    }
  }

  // Should not reach here, but safety net
  throw new AppError(4003, {
    message: 'EFFIS fetch exhausted all attempts',
    meta: { totalAttempts },
  });
}
