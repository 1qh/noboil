import { GlobalRegistrator } from '@happy-dom/global-registrator'
if (typeof document === 'undefined') GlobalRegistrator.register()
const { renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { applyOptimistic, useOwnRows } = await import('../react/use-list')
describe('applyOptimistic', () => {
  test('returns input unchanged when no pending', () => {
    const items = [{ _id: 'a' }]
    expect(applyOptimistic(items, [])).toBe(items as never)
  })
  test('applies delete', () => {
    const items = [{ _id: 'a' }, { _id: 'b' }]
    const out = applyOptimistic(items, [{ args: {}, id: 'a', tempId: 't', timestamp: 0, type: 'delete' }])
    expect(out.find(i => i._id === 'a')).toBeUndefined()
  })
  test('applies update + create', () => {
    const items = [{ _id: 'a', name: 'Old' }]
    const out = applyOptimistic(items, [
      { args: { name: 'New' }, id: 'a', tempId: 't1', timestamp: 1, type: 'update' },
      { args: { name: 'C' }, id: '', tempId: 't2', timestamp: 2, type: 'create' }
    ])
    expect(out.find(i => i._id === 'a')).toMatchObject({ name: 'New' })
    expect(out[0]?._id).toBe('t2')
  })
})
describe('useOwnRows', () => {
  test('marks rows with own=true/false based on isOwn', () => {
    const { result } = renderHook(() =>
      useOwnRows(
        [
          { _id: 'a', userId: 'u1' },
          { _id: 'b', userId: 'u2' }
        ],
        r => r.userId === 'u1'
      )
    )
    expect(result.current[0]?.own).toBe(true)
    expect(result.current[1]?.own).toBe(false)
  })
  test('marks rows with own=false when isOwn is null', () => {
    const { result } = renderHook(() => useOwnRows([{ _id: 'a' }], null))
    expect(result.current[0]?.own).toBe(false)
  })
})
