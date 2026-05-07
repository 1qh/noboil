// biome-ignore-all lint/performance/noAwaitInLoops: x
// biome-ignore-all lint/suspicious/useAwait: x
import { createRetryUtils } from '../shared/retry'
import { sleep } from './constants'
const { fetchWithRetry, withRetry } = createRetryUtils({ sleep })
export type { RetryOptions } from '../shared/retry'
export { fetchWithRetry, withRetry }
