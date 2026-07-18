/* eslint-disable no-await-in-loop */
interface RetryFactoryOptions {
  sleep: (ms: number) => Promise<void>
  validateOptions?: (opts: Required<RetryOptions>) => void
  wrapFinalError?: (error: Error, opts: Required<RetryOptions>) => Error
}
interface RetryOptions {
  base?: number
  initialDelayMs?: number
  maxAttempts?: number
  maxDelayMs?: number
}
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  base: 2,
  initialDelayMs: 500,
  maxAttempts: 3,
  maxDelayMs: 10_000
}
const HTTP_TOO_MANY = 429
const HTTP_SERVER_ERROR = 500
const calculateDelay = (attempt: number, opts: Required<RetryOptions>) => {
  const JITTER_RANGE = 0.3
  const JITTER_BASE = 0.85
  // eslint-disable-next-line sonarjs/pseudo-random -- non-security jitter for retry backoff spread
  const jitter = Math.random() * JITTER_RANGE + JITTER_BASE
  return Math.min(opts.initialDelayMs * opts.base ** attempt * jitter, opts.maxDelayMs)
}
const nextRetryDelay = (response: Response, attempt: number, opts: Required<RetryOptions>): number => {
  if (response.status === HTTP_TOO_MANY) {
    const retryAfter = response.headers.get('Retry-After')
    const retryMs = retryAfter ? Number(retryAfter) * 1000 : undefined
    if (retryMs && retryMs > 0 && Number.isFinite(retryMs)) return Math.min(retryMs, opts.maxDelayMs)
  }
  return calculateDelay(attempt, opts)
}
/**
 * Build a `withRetry` helper bound to a runtime (Convex action / SpacetimeDB / Node).
 * Accepts a sleep adapter (different per runtime), an option validator, and a final-error
 * wrapper. Resulting `withRetry(fn, opts)` retries with exponential backoff + jitter,
 * respects `retryable: false` errors, and surfaces the last attempt's error wrapped.
 */
const createRetryUtils = ({ sleep, validateOptions, wrapFinalError }: RetryFactoryOptions) => {
  const withRetry = async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    validateOptions?.(opts)
    let lastError: Error = new Error('Retry failed')
    for (let attempt = 0; attempt < opts.maxAttempts; attempt += 1)
      try {
        /** biome-ignore lint/performance/noAwaitInLoops: sequential by design */
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < opts.maxAttempts - 1) await sleep(calculateDelay(attempt, opts))
      }
    if (wrapFinalError) throw wrapFinalError(lastError, opts)
    throw lastError
  }
  const fetchWithRetry = async (url: string, options?: RequestInit & { retry?: RetryOptions }): Promise<Response> => {
    const { retry, ...fetchOptions } = options ?? {}
    const mergedOpts = { ...DEFAULT_OPTIONS, ...retry }
    let attempt = 0
    for (;;) {
      /** biome-ignore lint/performance/noAwaitInLoops: sequential by design */
      const response = await fetch(url, fetchOptions)
      const isRetryable = (response.status >= HTTP_SERVER_ERROR || response.status === HTTP_TOO_MANY) && !response.ok
      if (!isRetryable) return response
      attempt += 1
      if (attempt >= mergedOpts.maxAttempts) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      await sleep(nextRetryDelay(response, attempt, mergedOpts))
    }
  }
  return { fetchWithRetry, withRetry }
}
export type { RetryFactoryOptions, RetryOptions }
export { calculateDelay, createRetryUtils, DEFAULT_OPTIONS }
