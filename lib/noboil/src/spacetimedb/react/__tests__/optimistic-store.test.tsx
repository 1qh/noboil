/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof document === 'undefined') GlobalRegistrator.register()
const { describe, expect, mock, test } = await import('bun:test')
const { renderHook } = await import('@testing-library/react')
const React = await import('react')
const { createOptimisticStore, makeTempId, OptimisticProvider, usePendingMutations } = await import('../optimistic-store')
const mkRow = (id: string, extra: Record<string, unknown> = {}): { _id: string; name?: string } => ({ _id: id, ...extra })
describe('stdb optimistic-store', () => {
  test('makeTempId returns unique strings', () => {
    expect(makeTempId()).not.toBe(makeTempId())
  })
  test('add + getSnapshot preserve insertion order', () => {
    const s = createOptimisticStore()
    s.add({ args: { v: 1 }, id: '', tempId: 't1', timestamp: 0, type: 'create' })
    s.add({ args: { v: 2 }, id: '', tempId: 't2', timestamp: 1, type: 'create' })
    expect(s.getSnapshot().map(p => p.tempId)).toEqual(['t1', 't2'])
  })
  test('overlay applies create/update/delete', () => {
    const s = createOptimisticStore()
    s.add({ args: { v: 1 }, id: '', tempId: 't1', timestamp: 0, type: 'create' })
    s.add({ args: { name: 'B' }, id: 'r1', tempId: 't2', timestamp: 0, type: 'update' })
    s.add({ args: {}, id: 'r2', tempId: 't3', timestamp: 0, type: 'delete' })
    const overlaid = s.overlay([mkRow('r1', { name: 'A' }), mkRow('r2'), mkRow('r3')])
    expect(overlaid.find(r => r._id === 'r2')).toBeUndefined()
    expect(overlaid.find(r => r._id === 'r1')).toMatchObject({ name: 'B' })
    expect(overlaid[0]?._id).toBe('t1')
  })
  test('overlay with no pending returns input unchanged', () => {
    const s = createOptimisticStore()
    const rows = [mkRow('a')]
    expect(s.overlay(rows)).toBe(rows as never)
  })
  test('reconcileIds removes matching pending entries', () => {
    const s = createOptimisticStore()
    s.add({ args: {}, id: 'r1', tempId: 't1', timestamp: 0, type: 'update' })
    s.add({ args: {}, id: 'r2', tempId: 't2', timestamp: 0, type: 'update' })
    s.reconcileIds(['r1'])
    expect(s.getSnapshot()).toHaveLength(1)
    s.reconcileIds([])
    expect(s.getSnapshot()).toHaveLength(1)
  })
  test('reconcileRows clears entries by row id', () => {
    const s = createOptimisticStore()
    s.add({ args: {}, id: 'r1', tempId: 't1', timestamp: 0, type: 'update' })
    s.reconcileRows([{ _id: 'r1' }])
    expect(s.getSnapshot()).toHaveLength(0)
  })
  test('OptimisticProvider renders children with store context', () => {
    const wrap = ({ children }: { children: React.ReactNode }) => React.createElement(OptimisticProvider, null, children)
    const { result } = renderHook(() => usePendingMutations(), { wrapper: wrap })
    expect(result.current).toEqual([])
  })
  test('remove + subscribe notify listeners', () => {
    const s = createOptimisticStore()
    const cb = mock(() => {
      /* Empty */
    })
    const off = s.subscribe(cb)
    s.add({ args: {}, id: '', tempId: 't1', timestamp: 0, type: 'create' })
    s.remove('t1')
    s.remove('absent')
    off()
    expect(cb).toHaveBeenCalled()
  })
})
