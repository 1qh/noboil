/** biome-ignore-all lint/nursery/useGlobalThis: act needs window context */
import { GlobalRegistrator } from '@happy-dom/global-registrator'
if (typeof document === 'undefined') GlobalRegistrator.register()
const { act, renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { useBulkSelection } = await import('../react/use-bulk-selection')
const items = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]
describe('useBulkSelection (shared)', () => {
  test('initial selected is empty', () => {
    const { result } = renderHook(() => useBulkSelection({ items, orgId: 'o', undoMs: 1000 }))
    expect(result.current.selected.size).toBe(0)
  })
  test('toggleSelect adds + removes id', () => {
    const { result } = renderHook(() => useBulkSelection({ items, orgId: 'o', undoMs: 1000 }))
    act(() => {
      result.current.toggleSelect('a')
    })
    expect(result.current.selected.has('a')).toBe(true)
    act(() => {
      result.current.toggleSelect('a')
    })
    expect(result.current.selected.has('a')).toBe(false)
  })
  test('toggleSelectAll fills, then clears', () => {
    const { result } = renderHook(() => useBulkSelection({ items, orgId: 'o', undoMs: 1000 }))
    act(() => {
      result.current.toggleSelectAll()
    })
    expect(result.current.selected.size).toBe(items.length)
    act(() => {
      result.current.toggleSelectAll()
    })
    expect(result.current.selected.size).toBe(0)
  })
  test('clear removes everything', () => {
    const { result } = renderHook(() => useBulkSelection({ items, orgId: 'o', undoMs: 1000 }))
    act(() => {
      result.current.toggleSelect('a')
      result.current.toggleSelect('b')
    })
    act(() => {
      result.current.clear()
    })
    expect(result.current.selected.size).toBe(0)
  })
  test('handleBulkDelete with no selection is a no-op', async () => {
    let calls = 0
    const rm = async () => {
      calls += 1
    }
    const { result } = renderHook(() => useBulkSelection({ items, orgId: 'o', rm, undoMs: 1000 }))
    await act(async () => {
      await result.current.handleBulkDelete()
    })
    expect(calls).toBe(0)
  })
  test('handleBulkDelete calls rm with selected ids + orgId', async () => {
    let received: { ids?: string[]; orgId?: string } = {}
    const rm = async (args: { id?: string; ids?: string[]; orgId: string }) => {
      received = { ids: args.ids, orgId: args.orgId }
    }
    let successCount = 0
    const onSuccess = (c: number) => {
      successCount = c
    }
    const { result } = renderHook(() => useBulkSelection({ items, onSuccess, orgId: 'org-1', rm, undoMs: 1000 }))
    act(() => {
      result.current.toggleSelect('a')
      result.current.toggleSelect('c')
    })
    await act(async () => {
      await result.current.handleBulkDelete()
    })
    expect(received.orgId).toBe('org-1')
    expect(received.ids?.toSorted()).toEqual(['a', 'c'])
    expect(successCount).toBe(2)
  })
  test('handleBulkDelete with t + restore registers undo toast', async () => {
    let toastCalls = 0
    let restoreCalls = 0
    const t = (_msg: string, _opts?: { action?: { onClick?: () => void } }) => {
      toastCalls += 1
      if (_opts?.action?.onClick) _opts.action.onClick()
    }
    const rm = async () => undefined
    const restore = async () => {
      restoreCalls += 1
    }
    const { result } = renderHook(() =>
      useBulkSelection({ items, orgId: 'o', restore, rm, toast: t, undoLabel: 'todo', undoMs: 100 })
    )
    act(() => {
      result.current.toggleSelect('a')
      result.current.toggleSelect('b')
    })
    await act(async () => {
      await result.current.handleBulkDelete()
    })
    expect(toastCalls).toBeGreaterThanOrEqual(1)
    expect(restoreCalls).toBeGreaterThanOrEqual(1)
  })
  test('handleBulkDelete calls onError when rm throws', async () => {
    let captured: unknown
    const rm = async () => {
      throw new Error('fail!')
    }
    const onError = (e: unknown) => {
      captured = e
    }
    const { result } = renderHook(() => useBulkSelection({ items, onError, orgId: 'o', rm, undoMs: 1000 }))
    act(() => {
      result.current.toggleSelect('a')
    })
    await act(async () => {
      await result.current.handleBulkDelete()
    })
    expect((captured as Error).message).toBe('fail!')
  })
})
