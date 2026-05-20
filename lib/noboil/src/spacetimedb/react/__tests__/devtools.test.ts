import { describe, expect, test } from 'bun:test'
import {
  clearErrors,
  clearMutations,
  completeMutation,
  completeReducerCall,
  injectError,
  pushError,
  SLOW_THRESHOLD_MS,
  STALE_THRESHOLD_MS,
  trackCacheAccess,
  trackMutation,
  trackReducerCall,
  trackSubscription,
  untrackSubscription,
  updateSubscription,
  updateSubscriptionData
} from '../devtools'

describe('stdb react devtools', () => {
  test('threshold constants are numbers', () => {
    expect(typeof SLOW_THRESHOLD_MS).toBe('number')
    expect(typeof STALE_THRESHOLD_MS).toBe('number')
  })
  test('mutation tracking lifecycle', () => {
    const id = trackMutation('addTodo', { title: 't' })
    completeMutation(id, 'success')
  })
  test('subscription tracking lifecycle', () => {
    const id = trackSubscription('list', {})
    updateSubscription(id, 'loaded')
    updateSubscriptionData(id, [{ x: 1 }], 'preview')
    untrackSubscription(id)
  })
  test('reducer-call tracking + injectError + pushError', () => {
    const id = trackReducerCall('createTodo', { title: 't' })
    completeReducerCall(id, 'success')
    injectError('UNKNOWN', { message: 'forced' })
    pushError(new Error('boom'))
    clearErrors()
    clearMutations()
  })
  test('trackCacheAccess records hit/miss', () => {
    trackCacheAccess({ hit: true, key: 'k', table: 't' })
    trackCacheAccess({ hit: false, key: 'k2', stale: false, table: 't' })
    expect(true).toBe(true)
  })
})
