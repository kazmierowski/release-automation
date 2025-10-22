import { logger } from './logger.js';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Base delay in milliseconds before first retry (default: 2000ms) */
  baseDelayMs?: number;

  /** Maximum delay in milliseconds between retries (default: 8000ms) */
  maxDelayMs?: number;

  /** Function to determine if error is retryable (default: all errors retryable) */
  isRetryable?: (error: Error) => boolean;

  /** Callback invoked on each retry attempt */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Default retry configuration from environment or defaults
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
  baseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS || '2000', 10),
  maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || '8000', 10),
  isRetryable: () => true, // Retry all errors by default
  onRetry: (attempt, error, delayMs) => {
    logger.warn(
      `Retry attempt ${attempt} after ${delayMs}ms due to: ${error.message}`
    );
  },
};

/**
 * Calculate exponential backoff delay with jitter
 *
 * Formula: min(baseDelay * 2^(attempt-1) + jitter, maxDelay)
 * Jitter: random value between 0 and 500ms to prevent thundering herd
 *
 * @param attempt - Current attempt number (1-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 500; // 0-500ms jitter
  const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - Async function to retry
 * @param options - Retry configuration options
 * @returns Promise resolving to operation result
 * @throws {Error} If all retry attempts fail or error is not retryable
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => fetchDataFromAPI(),
 *   {
 *     maxAttempts: 3,
 *     baseDelayMs: 1000,
 *     maxDelayMs: 5000,
 *     isRetryable: (error) => error.message.includes('timeout'),
 *   }
 * );
 * ```
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<RetryOptions> = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Attempt operation
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!opts.isRetryable(lastError)) {
        logger.error(
          `Non-retryable error encountered: ${lastError.message}`
        );
        throw lastError;
      }

      // Check if we've exhausted all attempts
      if (attempt >= opts.maxAttempts) {
        logger.error(
          `All ${opts.maxAttempts} retry attempts failed: ${lastError.message}`
        );
        throw lastError;
      }

      // Calculate backoff delay
      const delayMs = calculateBackoffDelay(
        attempt,
        opts.baseDelayMs,
        opts.maxDelayMs
      );

      // Invoke retry callback
      opts.onRetry(attempt, lastError, delayMs);

      // Wait before next attempt
      await sleep(delayMs);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Common retryable error patterns for external services
 */
export const RETRYABLE_ERROR_PATTERNS = {
  /** Network-related errors */
  network: (error: Error): boolean => {
    const message = error.message.toLowerCase();
    return (
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('econnrefused') ||
      message.includes('network') ||
      message.includes('timeout')
    );
  },

  /** HTTP 5xx server errors */
  serverError: (error: Error): boolean => {
    const message = error.message;
    return (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  },

  /** HTTP 429 rate limiting */
  rateLimited: (error: Error): boolean => {
    return error.message.includes('429') || error.message.includes('rate limit');
  },

  /** Combined: retry on any transient error */
  transient: (error: Error): boolean => {
    return (
      RETRYABLE_ERROR_PATTERNS.network(error) ||
      RETRYABLE_ERROR_PATTERNS.serverError(error) ||
      RETRYABLE_ERROR_PATTERNS.rateLimited(error)
    );
  },
};

/**
 * Retry configuration for Jenkins API calls
 * - 3 attempts
 * - Exponential backoff: 2s, 4s, 8s
 * - Retry on network errors and 5xx responses
 */
export const JENKINS_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 8000,
  isRetryable: RETRYABLE_ERROR_PATTERNS.transient,
  onRetry: (attempt, error, delayMs) => {
    logger.warn(`Jenkins API retry attempt ${attempt} after ${delayMs}ms`, {
      error: error.message,
    });
  },
};

/**
 * Retry configuration for JIRA API calls
 * - 3 attempts
 * - Exponential backoff: 1s, 2s, 4s (faster than Jenkins)
 * - Retry on network errors and 5xx responses
 */
export const JIRA_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 4000,
  isRetryable: RETRYABLE_ERROR_PATTERNS.transient,
  onRetry: (attempt, error, delayMs) => {
    logger.warn(`JIRA API retry attempt ${attempt} after ${delayMs}ms`, {
      error: error.message,
    });
  },
};

/**
 * Retry configuration for Git platform API calls
 * - 3 attempts
 * - Exponential backoff: 2s, 4s, 8s
 * - Retry on network errors and 5xx responses
 */
export const GIT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 8000,
  isRetryable: RETRYABLE_ERROR_PATTERNS.transient,
  onRetry: (attempt, error, delayMs) => {
    logger.warn(`Git API retry attempt ${attempt} after ${delayMs}ms`, {
      error: error.message,
    });
  },
};

/**
 * Retry configuration for Microsoft Teams API calls
 * - 3 attempts
 * - Exponential backoff: 1s, 2s, 4s
 * - Retry on network errors, 5xx responses, and rate limiting
 */
export const TEAMS_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 4000,
  isRetryable: RETRYABLE_ERROR_PATTERNS.transient,
  onRetry: (attempt, error, delayMs) => {
    logger.warn(`Teams API retry attempt ${attempt} after ${delayMs}ms`, {
      error: error.message,
    });
  },
};
