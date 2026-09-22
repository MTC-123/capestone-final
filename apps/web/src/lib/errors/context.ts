import { AppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/observability/logger';

/**
 * Operation labeling for Promise.all
 * Wraps a promise to add descriptive context when it fails
 */
export function labelOperation<T>(
  operation: Promise<T>,
  label: string
): Promise<T> {
  return operation.catch((err) => {
    const meta: Record<string, unknown> = { operation: label };

    // Extract metadata from error if available
    if (err && typeof err === 'object') {
      if ('code' in err) meta.originalCode = err.code;
      if ('message' in err) meta.originalMessage = err.message;
      if ('name' in err) meta.originalName = err.name;
    }

    throw new AppError(5000, {
      message: `Operation "${label}" failed`,
      meta,
      cause: err,
    });
  });
}

/**
 * External API response context
 */
export interface ExternalApiContext {
  provider: string;
  url: string;
  method: string;
  startedAt: number;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBodyPreview?: string;
  durationMs?: number;
}

/**
 * Capture external API error with full context
 */
export function captureExternalApiError(
  context: ExternalApiContext,
  error: unknown
): AppError {
  const durationMs = context.durationMs ?? performance.now() - context.startedAt;

  const meta: Record<string, unknown> = {
    provider: context.provider,
    url: context.url,
    method: context.method,
    durationMs,
  };

  if (context.responseStatus) {
    meta.responseStatus = context.responseStatus;
  }

  if (context.responseHeaders) {
    meta.responseHeaders = context.responseHeaders;
  }

  if (context.responseBodyPreview) {
    meta.responseBodyPreview = context.responseBodyPreview;
  }

  // Log the external API failure
  logger.error({
    event: 'external_api_error',
    meta,
    error: {
      name: (error as Error)?.name,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    },
  });

  return new AppError(4000, {
    message: `External API request to ${context.provider} failed`,
    meta,
    cause: error,
  });
}

/**
 * Retry context for logging retry attempts
 */
export interface RetryContext {
  operation: string;
  attempt: number;
  maxAttempts: number;
  cumulativeDurationMs: number;
  lastError?: string;
  classification?: 'database' | 'network' | 'timeout' | 'validation' | 'unknown';
}

/**
 * Log a retry attempt with full context
 */
export function logRetryAttempt(context: RetryContext): void {
  logger.warn({
    event: 'retry_attempt',
    meta: {
      operation: context.operation,
      attempt: context.attempt,
      maxAttempts: context.maxAttempts,
      cumulativeDurationMs: context.cumulativeDurationMs,
      lastError: context.lastError,
      classification: context.classification,
      isLastAttempt: context.attempt >= context.maxAttempts,
    },
  });
}

/**
 * Format a value for error messages (safely stringify, truncate if needed)
 */
export function formatValueForError(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';

  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    // Truncate long values
    return str.length > 100 ? `${str.slice(0, 100)}...` : str;
  } catch {
    return String(value);
  }
}

/**
 * Create a validation error with actual invalid value
 */
export function validationError(
  field: string,
  code: string,
  actualValue: unknown,
  message?: string
): AppError {
  const formattedValue = formatValueForError(actualValue);

  return new AppError(1001, {
    message: message ?? `Validation failed for field "${field}"`,
    fields: [
      {
        field,
        code,
        message: message ?? `Expected valid value, got: ${formattedValue}`,
      },
    ],
    meta: {
      invalidValues: {
        [field]: actualValue,
      },
    },
  });
}
