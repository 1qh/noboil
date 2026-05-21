import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof document === 'undefined') GlobalRegistrator.register()
const { act, renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { collectSettled, resolveBulkError, useBulkMutate } = await import('../use-bulk-mutate')
const { usePendingMutations } = await import('../optimistic-store')
describe('stdb useBulkMutate wrapper', () => {
  test('renderHook returns isPending=false initially', () => {
    const { result } = renderHook(() => useBulkMutate(async () => undefined))
    expect(result.current.isPending).toBe(false)
  })
  test('run resolves all items', async () => {
    const { result } = renderHook(() => useBulkMutate(async (n: number) => n + 1))
    let res: undefined | { errors: unknown[]; results: number[] }
    await act(async () => {
      res = await result.current.run([1, 2])
    })
    expect(res?.results.toSorted()).toEqual([2, 3])
  })
  test('collectSettled splits results + errors', () => {
    const out = collectSettled([
      { status: 'fulfilled' as const, value: 1 },
      { reason: new Error('x'), status: 'rejected' as const }
    ])
    expect(out.results).toEqual([1])
    expect(out.errors).toHaveLength(1)
  })
  test('resolveBulkError returns undefined when onError=false', () => {
    expect(resolveBulkError({ onError: false })).toBeUndefined()
  })
  test('usePendingMutations without provider returns empty array', () => {
    const { result } = renderHook(() => usePendingMutations())
    expect(result.current).toEqual([])
  })
})
