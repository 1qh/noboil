import { GlobalRegistrator } from '@happy-dom/global-registrator'
if (typeof document === 'undefined') GlobalRegistrator.register()
const { renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { createOptimisticStore, makeTempId, usePendingMutations } = await import('../react/optimistic-store')
describe('convex optimistic-store', () => {
  test('makeTempId returns unique strings', () => {
    expect(makeTempId()).not.toBe(makeTempId())
  })
  test('createOptimisticStore subscribe + add + remove', () => {
    const s = createOptimisticStore()
    let calls = 0
    const off = s.subscribe(() => {
      calls += 1
    })
    s.add({ args: {}, id: '', tempId: 't1', timestamp: 0, type: 'create' })
    expect(s.getSnapshot()).toHaveLength(1)
    s.remove('t1')
    expect(s.getSnapshot()).toHaveLength(0)
    expect(calls).toBeGreaterThan(0)
    off()
  })
  test('usePendingMutations without provider returns empty array', () => {
    const { result } = renderHook(() => usePendingMutations())
    expect(result.current).toEqual([])
  })
})
