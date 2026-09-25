/** Exponential backoff with jitter, capped at 5 minutes, starting at 1 second. */
const BASE_DELAY_MS = 1000;
export const MAX_DELAY_MS = 5 * 60 * 1000;

/**
 * `attempt` is 1-based (the attempt number that just failed). Returns a
 * delay in milliseconds, randomized within the top half of the exponential
 * window so retries from many devices don't synchronize.
 */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const exponent = Math.max(0, attempt - 1);
  const raw = BASE_DELAY_MS * 2 ** exponent;
  const capped = Math.min(MAX_DELAY_MS, raw);
  const jittered = capped * (0.5 + random() * 0.5);
  return Math.min(MAX_DELAY_MS, Math.round(jittered));
}
