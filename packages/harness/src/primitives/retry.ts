/**
 * Exponential backoff retry utilities for Generator-Retry loops.
 *
 * Core pattern:
 *   Generator yields → Evaluator checks → On failure, retry with backoff
 *
 * Usage:
 *   const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 500 });
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Initial delay in ms before first retry. Default: 500 */
  initialDelayMs?: number;
  /** Maximum delay in ms. Default: 8000 */
  maxDelayMs?: number;
  /** Backoff multiplier. Default: 2.0 */
  backoffMultiplier?: number;
  /** Predicate to determine if an error is retryable. Default: all errors retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry with attempt number and delay */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

/** Result of a retry operation */
export interface RetryResult<T> {
  /** The successful result (undefined if all attempts failed) */
  data?: T;
  /** The last error encountered */
  error?: unknown;
  /** Total attempts made */
  attempts: number;
  /** Whether we exhausted all retries */
  exhausted: boolean;
}

/** Sleep utility using native Promise */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timer: any = (globalThis as any).setTimeout ?? (globalThis as any).setInterval;
    timer(resolve, ms);
  });
}

/**
 * Compute the delay for a given attempt using exponential backoff with jitter.
 * Jitter prevents thundering herd when multiple clients retry simultaneously.
 */
export function computeDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
): number {
  // Exponential backoff
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  // Cap at max
  const capped = Math.min(exponentialDelay, maxDelayMs);
  // Add ±20% jitter to prevent thundering herd
  const jitter = capped * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(capped + jitter);
}

/**
 * Retry a function with exponential backoff.
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the function or the last error
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelayMs = 500,
    maxDelayMs = 8000,
    backoffMultiplier = 2.0,
    isRetryable = () => true,
    onRetry,
  } = options;

  let lastError: unknown;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const data = await fn();
      return { data, attempts, exhausted: false };
    } catch (err) {
      lastError = err;

      if (attempts >= maxAttempts) {
        return { error: err, attempts, exhausted: true };
      }

      if (!isRetryable(err)) {
        return { error: err, attempts, exhausted: true };
      }

      const delayMs = computeDelay(
        attempts,
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier,
      );

      onRetry?.(attempts, delayMs, err);
      await sleep(delayMs);
    }
  }

  return { error: lastError, attempts, exhausted: true };
}

/**
 * Map retryable HTTP status codes to boolean.
 * Common retryable codes: 429 (rate limit), 500, 502, 503, 504
 */
export function isHttpRetryable(statusCode: number): boolean {
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

/**
 * Build a retryable predicate from a set of HTTP status codes.
 */
export function httpRetryablePredicate(retryableCodes: number[] = [429, 500, 502, 503, 504]) {
  return (error: unknown): boolean => {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      return retryableCodes.includes((error as { statusCode: number }).statusCode);
    }
    return false;
  };
}

/**
 * Async generator wrapper that retries on failures.
 * Yields items from the generator, retrying the generator itself on failure.
 *
 * This is useful for generators that make HTTP calls internally.
 */
export async function* retryingGenerator<T, R>(
  generator: () => AsyncGenerator<T, R, unknown>,
  options: RetryOptions = {},
): AsyncGenerator<T, R, unknown> {
  const {
    maxAttempts = 3,
    initialDelayMs = 500,
    maxDelayMs = 8000,
    backoffMultiplier = 2.0,
    isRetryable = () => true,
    onRetry,
  } = options;

  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    let gen: AsyncGenerator<T, R, unknown>;

    try {
      gen = generator();
    } catch (err) {
      if (attempts >= maxAttempts || !isRetryable(err)) throw err;
      const delayMs = computeDelay(attempts, initialDelayMs, maxDelayMs, backoffMultiplier);
      onRetry?.(attempts, delayMs, err);
      await sleep(delayMs);
      continue;
    }

    try {
      let result: IteratorResult<T, R>;
      while (!(result = await gen.next()).done) {
        yield result.value;
      }
      return result.value;
    } catch (err) {
      if (attempts >= maxAttempts || !isRetryable(err)) throw err;
      const delayMs = computeDelay(attempts, initialDelayMs, maxDelayMs, backoffMultiplier);
      onRetry?.(attempts, delayMs, err);
      await sleep(delayMs);
    }
  }

  throw new Error(`Generator exhausted all ${maxAttempts} retry attempts`);
}
