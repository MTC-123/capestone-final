import { logger } from '@/lib/observability/logger';
import { logRetryAttempt } from '@/lib/errors/context';

/**
 * Wraps a database operation with retry logic for transient errors.
 *
 * @param operation - The async operation to execute
 * @param operationName - A descriptive name for logging purposes
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns The result of the successful operation
 * @throws The error from the last failed attempt if all retries are exhausted
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = 2
): Promise<T> {
  const startedAt = performance.now();

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Only retry on Prisma/database errors (transient errors)
      const isPrismaError = error && typeof error === 'object' &&
        'name' in error && String(error.name).includes('Prisma');

      if (attempt > maxRetries || !isPrismaError) {
        // Final failure - log and rethrow
        logger.error({
          event: 'retry_exhausted',
          meta: {
            operation: operationName,
            totalAttempts: attempt,
            cumulativeDurationMs: performance.now() - startedAt,
          },
        });
        throw error;
      }

      // Log retry attempt
      logRetryAttempt({
        operation: operationName,
        attempt,
        maxAttempts: maxRetries + 1,
        cumulativeDurationMs: performance.now() - startedAt,
        lastError: (error as Error)?.message,
        classification: isPrismaError ? 'database' : 'unknown',
      });

      // Exponential backoff: 500ms, 1000ms, 1500ms, etc.
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }

  throw new Error('Unreachable');
}
