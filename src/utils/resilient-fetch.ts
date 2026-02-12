/**
 * Resilient fetch wrapper with configurable exponential backoff.
 *
 * Retries on network errors (TypeError / Failed to fetch) and 5xx responses.
 * Does NOT retry on 4xx (client errors) since those won't resolve by retrying.
 *
 * Base delay default (100ms) matches the `exponential-backoff` library.
 * Backoff schedule: baseDelayMs * 2^(attempt-1)  -->  100, 200, 400, 800, 1600, 3200 ...
 */

export interface ResilientFetchOptions extends RequestInit {
  /** Max retry attempts after the initial request (0 = no retries). Default: 0 */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff. Default: 100 */
  baseDelayMs?: number;
  /**
   * Custom predicate to decide whether a failed attempt should be retried.
   * Called with the caught error (for network failures) or the Response (for HTTP errors).
   * Return `true` to retry, `false` to fail immediately.
   * Default: retry on network errors + 5xx status codes.
   */
  retryOn?: (error: unknown, response?: Response) => boolean;
  /** Called before each retry. Useful for per-call-site logging. */
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
}

/** Default retry predicate: network errors + 5xx */
function defaultRetryOn(error: unknown, response?: Response): boolean {
  // Network failure (server down, connection refused, DNS failure)
  if (error instanceof TypeError) return true;
  if (error instanceof Error && error.message.includes('Failed to fetch')) return true;

  // Server error (5xx) -- server may be restarting or overloaded
  if (response && response.status >= 500) return true;

  return false;
}

export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  const {
    maxRetries = 0,
    baseDelayMs = 100,
    retryOn = defaultRetryOn,
    onRetry,
    ...fetchOptions
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Backoff delay before retries (not before the first attempt)
    if (attempt > 0) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      onRetry?.(attempt, delay, lastError);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const response = await fetch(url, fetchOptions);

      // Check if the response is retryable (5xx)
      if (!response.ok && attempt < maxRetries && retryOn(null, response)) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      // Check if this error is retryable
      if (attempt < maxRetries && retryOn(error)) {
        continue;
      }

      throw error;
    }
  }

  // Should only be reached if all retries exhausted via the `continue` path
  // (5xx responses that were retryable). Re-fetch one last time to get the response.
  // This path means we got a 5xx on the last attempt -- return that response
  // so the caller can inspect the status.
  throw lastError;
}
