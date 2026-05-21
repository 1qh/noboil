import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof document === 'undefined') GlobalRegistrator.register()
const { act, renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { collectSettled, resolveBulkError, useBulkMutate } = await import('../react/use-bulk-mutate')
describe('convex useBulkMutate wrapper', () => {
  test('renderHook returns isPending=false initially', () => {
    const { result } = renderHook(() => useBulkMutate(async () => undefined))
    expect(result.current.isPending).toBe(false)
  })
  test('run([]) returns empty result', async () => {
    const { result } = renderHook(() => useBulkMutate(async (n: number) => n))
    let res: undefined | { errors: unknown[]; results: number[] }
    await act(async () => {
      res = await result.current.run([])
    })
    expect(res?.results).toHaveLength(0)
  })
  test('run resolves all items', async () => {
    const { result } = renderHook(() => useBulkMutate(async (n: number) => n * 2))
    let res: undefined | { errors: unknown[]; results: number[] }
    await act(async () => {
      res = await result.current.run([1, 2, 3])
    })
    expect(res?.results.toSorted()).toEqual([2, 4, 6])
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
})
