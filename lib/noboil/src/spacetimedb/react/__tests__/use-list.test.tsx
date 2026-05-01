import { GlobalRegistrator } from '@happy-dom/global-registrator'
if (typeof document === 'undefined') GlobalRegistrator.register()
const { renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { DEFAULT_PAGE_SIZE, useOwnRows } = await import('../use-list')
describe('stdb useOwnRows', () => {
  test('marks rows with own based on isOwn', () => {
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
  test('marks own=false when isOwn is null', () => {
    const { result } = renderHook(() => useOwnRows([{ _id: 'a' }], null))
    expect(result.current[0]?.own).toBe(false)
  })
  test('DEFAULT_PAGE_SIZE is exported', () => {
    expect(typeof DEFAULT_PAGE_SIZE).toBe('number')
  })
})
