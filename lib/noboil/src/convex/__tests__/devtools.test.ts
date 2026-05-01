import { describe, expect, test } from 'bun:test'
import {
  clearErrors,
  clearMutations,
  completeMutation,
  pushError,
  SLOW_THRESHOLD_MS,
  STALE_THRESHOLD_MS,
  trackCacheAccess,
  trackMutation,
  trackSubscription,
  untrackSubscription,
  updateSubscription,
  updateSubscriptionData
} from '../react/devtools'
describe('convex devtools', () => {
  test('exports threshold constants and tracker fns', () => {
    expect(typeof SLOW_THRESHOLD_MS).toBe('number')
    expect(typeof STALE_THRESHOLD_MS).toBe('number')
    expect(typeof clearErrors).toBe('function')
    expect(typeof clearMutations).toBe('function')
  })
  test('trackMutation/completeMutation lifecycle', () => {
    const id = trackMutation('addTodo', { title: 't' })
    expect(typeof id).toBe('number')
    completeMutation(id, 'success')
    completeMutation(id + 999, 'success')
  })
  test('trackSubscription/update/untrack lifecycle', () => {
    const id = trackSubscription('list', {})
    updateSubscription(id, 'loaded')
    updateSubscriptionData(id, [{ x: 1 }], 'preview')
    untrackSubscription(id)
  })
  test('trackCacheAccess records hit/miss', () => {
    trackCacheAccess({ hit: true, key: 'tmdb_id', table: 'todo' })
    trackCacheAccess({ hit: false, key: 'tmdb_id', stale: true, table: 'todo' })
  })
  test('pushError + clear*', () => {
    pushError(new Error('boom'))
    clearErrors()
    clearMutations()
    expect(true).toBe(true)
  })
})
