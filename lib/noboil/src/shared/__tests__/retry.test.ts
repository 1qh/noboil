/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { afterEach, describe, expect, test } from 'bun:test'
import { calculateDelay, createRetryUtils, DEFAULT_OPTIONS } from '../retry'

const noSleep = async () => {
  /* Empty */
}
const utils = createRetryUtils({ sleep: noSleep })
describe('calculateDelay', () => {
  test('respects maxDelayMs cap', () => {
    const opts = { ...DEFAULT_OPTIONS, maxDelayMs: 1000 }
    expect(calculateDelay(10, opts)).toBeLessThanOrEqual(1000)
  })
  test('grows with attempt', () => {
    const a = calculateDelay(0, DEFAULT_OPTIONS)
    const b = calculateDelay(2, DEFAULT_OPTIONS)
    expect(b).toBeGreaterThan(a)
  })
})
describe('withRetry', () => {
  test('returns result on first success', async () => {
    let n = 0
    const r = await utils.withRetry(async () => {
      n += 1
      return 'ok'
    })
    expect(r).toBe('ok')
    expect(n).toBe(1)
  })
  test('retries until success', async () => {
    let n = 0
    const r = await utils.withRetry(async () => {
      n += 1
      if (n < 2) throw new Error('transient')
      return 'eventually'
    })
    expect(r).toBe('eventually')
    expect(n).toBe(2)
  })
  test('throws after maxAttempts', async () => {
    let n = 0
    await expect(
      utils.withRetry(
        async () => {
          n += 1
          throw new Error('always')
        },
        { maxAttempts: 2 }
      )
    ).rejects.toThrow('always')
    expect(n).toBe(2)
  })
  test('non-Error thrown is wrapped', async () => {
    await expect(
      utils.withRetry(
        async () => {
          throw new Error('string error')
        },
        { maxAttempts: 1 }
      )
    ).rejects.toThrow('string error')
  })
  test('wrapFinalError transforms last error', async () => {
    const u = createRetryUtils({
      sleep: noSleep,
      wrapFinalError: (e, opts) => new Error(`wrapped after ${opts.maxAttempts}: ${e.message}`)
    })
    await expect(u.withRetry(async () => Promise.reject(new Error('boom')), { maxAttempts: 2 })).rejects.toThrow(
      'wrapped after 2: boom'
    )
  })
  test('validateOptions runs', async () => {
    let saw = 0
    const u = createRetryUtils({
      sleep: noSleep,
      validateOptions: () => {
        saw += 1
      }
    })
    await u.withRetry(async () => 'ok')
    expect(saw).toBe(1)
  })
})
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})
const mockFetch = (responses: Response[]) => {
  let i = 0
  globalThis.fetch = (async (): Promise<Response> => {
    const r = responses[i] ?? responses.at(-1)
    i += 1
    if (!r) throw new Error('mockFetch: no responses queued')
    return r
  }) as unknown as typeof fetch
}
describe('fetchWithRetry', () => {
  test('returns 200 on first try', async () => {
    mockFetch([new Response('ok', { status: 200 })])
    const r = await utils.fetchWithRetry('https://x')
    expect(r.status).toBe(200)
  })
  test('retries 5xx then succeeds', async () => {
    mockFetch([new Response('', { status: 500 }), new Response('ok', { status: 200 })])
    const r = await utils.fetchWithRetry('https://x', { retry: { maxAttempts: 3 } })
    expect(r.status).toBe(200)
  })
  test('429 with Retry-After (seconds) honored', async () => {
    let slept = 0
    const u = createRetryUtils({
      sleep: async ms => {
        slept = ms
      }
    })
    mockFetch([new Response('', { headers: { 'Retry-After': '2' }, status: 429 }), new Response('ok', { status: 200 })])
    const r = await u.fetchWithRetry('https://x', { retry: { maxAttempts: 3, maxDelayMs: 5000 } })
    expect(r.status).toBe(200)
    expect(slept).toBe(2000)
  })
  test('429 with invalid Retry-After falls back to backoff', async () => {
    let slept = 0
    const u = createRetryUtils({
      sleep: async ms => {
        slept = ms
      }
    })
    mockFetch([new Response('', { headers: { 'Retry-After': 'soon' }, status: 429 }), new Response('ok', { status: 200 })])
    await u.fetchWithRetry('https://x', { retry: { maxAttempts: 3 } })
    expect(slept).toBeGreaterThan(0)
  })
  test('429 Retry-After capped at maxDelayMs', async () => {
    let slept = 0
    const u = createRetryUtils({
      sleep: async ms => {
        slept = ms
      }
    })
    mockFetch([new Response('', { headers: { 'Retry-After': '999' }, status: 429 }), new Response('ok', { status: 200 })])
    await u.fetchWithRetry('https://x', { retry: { maxAttempts: 3, maxDelayMs: 1500 } })
    expect(slept).toBe(1500)
  })
  test('throws after maxAttempts on persistent 5xx', async () => {
    mockFetch([new Response('', { status: 503, statusText: 'Service Unavailable' })])
    await expect(utils.fetchWithRetry('https://x', { retry: { maxAttempts: 2 } })).rejects.toThrow('HTTP 503')
  })
  test('non-retryable 4xx returns immediately', async () => {
    mockFetch([new Response('', { status: 404 })])
    const r = await utils.fetchWithRetry('https://x')
    expect(r.status).toBe(404)
  })
})
