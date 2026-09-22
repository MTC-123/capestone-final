import { getCircuitBreaker } from '@/lib/platform/circuitBreaker';
import { logRetryAttempt } from '@/lib/errors/context';
import { AppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/observability/logger';

export type FirmsEndpoint = {
  id: string;
  baseUrl: string;
  label: string;
};

export const FIRMS_ENDPOINTS: FirmsEndpoint[] = [
  { id: 'nasa-firms-primary', baseUrl: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv', label: 'FIRMS (original)' },
  { id: 'nasa-firms-fallback', baseUrl: 'https://firms2.modaps.eosdis.nasa.gov/api/area/csv', label: 'FIRMS2 (mirror)' },
];

export type FetchFirmsOptions = {
  apiKey: string;
  source: string;
  bbox: string;
  dayRange: number;
  timeoutMs: number;
};

export type FetchFirmsResult = {
  csvText: string;
  endpointUsed: string;
  durationMs: number;
  attemptsMade: number;
};

const TRANSIENT_STATUS_CODES = [502, 503, 504];
const RETRY_BACKOFF_MS = 1000;
const MAX_ATTEMPTS_PER_ENDPOINT = 2;

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

function isHtmlResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html');
}

function buildApiUrl(baseUrl: string, apiKey: string, source: string, bbox: string, dayRange: number): string {
  return `${baseUrl}/${apiKey}/${source}/${bbox}/${dayRange}`;
}

type EndpointFailure = {
  endpointId: string;
  label: string;
  error: string;
  attempts: number;
};

export async function fetchFirmsWithFallback(options: FetchFirmsOptions): Promise<FetchFirmsResult> {
  const { apiKey, source, bbox, dayRange, timeoutMs } = options;
  const failures: EndpointFailure[] = [];
  let totalAttempts = 0;

  for (const endpoint of FIRMS_ENDPOINTS) {
    const breaker = getCircuitBreaker(endpoint.id);

    if (!breaker.canRequest()) {
      logger.info({
        event: 'firms_endpoint_skipped',
        meta: { endpointId: endpoint.id, label: endpoint.label, reason: 'circuit_breaker_open' },
      });
      failures.push({
        endpointId: endpoint.id,
        label: endpoint.label,
        error: 'circuit_breaker_open',
        attempts: 0,
      });
      continue;
    }

    const apiUrl = buildApiUrl(endpoint.baseUrl, apiKey, source, bbox, dayRange);
    const startedAt = performance.now();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ENDPOINT; attempt++) {
      totalAttempts++;

      try {
        const response = await fetchWithTimeout(apiUrl, timeoutMs);

        // HTML response = auth failure — not transient, skip to next endpoint
        if (isHtmlResponse(response)) {
          breaker.onFailure();
          const errorMsg = 'HTML response (auth failure)';
          logger.error({
            event: 'firms_auth_failure',
            meta: { endpointId: endpoint.id, status: response.status, attempt },
          });
          failures.push({ endpointId: endpoint.id, label: endpoint.label, error: errorMsg, attempts: attempt });
          break; // Don't retry auth failures, fall through to next endpoint
        }

        // Transient HTTP error — retry if attempts remain
        if (!response.ok) {
          const bodyText = await response.text().catch(() => '');

          if (isTransientError(response.status) && attempt < MAX_ATTEMPTS_PER_ENDPOINT) {
            logRetryAttempt({
              operation: `firms_fetch_${endpoint.id}`,
              attempt,
              maxAttempts: MAX_ATTEMPTS_PER_ENDPOINT,
              cumulativeDurationMs: performance.now() - startedAt,
              lastError: `HTTP ${response.status}`,
              classification: 'network',
            });
            await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
            continue;
          }

          // Non-transient or final attempt
          breaker.onFailure();
          const errorMsg = `HTTP ${response.status}: ${bodyText.slice(0, 100)}`;
          failures.push({ endpointId: endpoint.id, label: endpoint.label, error: errorMsg, attempts: attempt });
          break;
        }

        // Success
        const csvText = await response.text();
        breaker.onSuccess();
        const durationMs = performance.now() - startedAt;

        logger.info({
          event: 'firms_endpoint_success',
          meta: { endpointId: endpoint.id, label: endpoint.label, attempt, durationMs: Math.round(durationMs) },
        });

        return { csvText, endpointUsed: endpoint.id, durationMs, attemptsMade: totalAttempts };
      } catch (error) {
        const durationMs = performance.now() - startedAt;

        // Timeout
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < MAX_ATTEMPTS_PER_ENDPOINT) {
            logRetryAttempt({
              operation: `firms_fetch_${endpoint.id}`,
              attempt,
              maxAttempts: MAX_ATTEMPTS_PER_ENDPOINT,
              cumulativeDurationMs: durationMs,
              lastError: 'timeout',
              classification: 'timeout',
            });
            await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
            continue;
          }

          breaker.onFailure();
          failures.push({ endpointId: endpoint.id, label: endpoint.label, error: `timeout after ${timeoutMs}ms`, attempts: attempt });
          break;
        }

        // Network error
        if (attempt < MAX_ATTEMPTS_PER_ENDPOINT) {
          logRetryAttempt({
            operation: `firms_fetch_${endpoint.id}`,
            attempt,
            maxAttempts: MAX_ATTEMPTS_PER_ENDPOINT,
            cumulativeDurationMs: durationMs,
            lastError: (error as Error)?.message ?? 'unknown',
            classification: 'network',
          });
          await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
          continue;
        }

        breaker.onFailure();
        failures.push({
          endpointId: endpoint.id,
          label: endpoint.label,
          error: (error as Error)?.message ?? 'unknown',
          attempts: attempt,
        });
        break;
      }
    }
  }

  // All endpoints exhausted
  logger.error({
    event: 'firms_all_endpoints_failed',
    meta: { failures, totalAttempts },
  });

  throw new AppError(4000, {
    message: 'All FIRMS endpoints failed',
    meta: { failures, totalAttempts },
  });
}
