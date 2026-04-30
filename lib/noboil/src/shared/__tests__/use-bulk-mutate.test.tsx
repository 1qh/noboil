import { GlobalRegistrator } from '@happy-dom/global-registrator'
if (typeof document === 'undefined') GlobalRegistrator.register()
const { act, renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { useBulkMutate } = await import('../react/use-bulk-mutate')
const swallowed: unknown[] = []
const defaultOnError = (e: unknown) => {
  swallowed.push(e)
}
describe('useBulkMutate (shared)', () => {
  test('initial state: not pending, no progress', () => {
    const mutate = async () => undefined
    const { result } = renderHook(() => useBulkMutate({ bulkMax: 50, defaultOnError, mutate, packageName: 'test' }))
    expect(result.current.isPending).toBe(false)
    expect(result.current.progress).toBeNull()
  })
  test('run on empty list returns empty result', async () => {
    const mutate = async () => undefined
    const { result } = renderHook(() => useBulkMutate({ bulkMax: 50, defaultOnError, mutate, packageName: 'test' }))
    let res: undefined | { errors: unknown[]; results: unknown[] }
    await act(async () => {
      res = await result.current.run([])
    })
    expect(res).toEqual({ errors: [], results: [], settled: [] } as never)
  })
  test('run resolves all items', async () => {
    let calls = 0
    const mutate = async (n: number) => {
      calls += 1
      return n * 2
    }
    const { result } = renderHook(() => useBulkMutate({ bulkMax: 50, defaultOnError, mutate, packageName: 'test' }))
    let res: undefined | { errors: unknown[]; results: number[] }
    await act(async () => {
      res = await result.current.run([1, 2, 3])
    })
    expect(calls).toBe(3)
    expect(res?.results.toSorted()).toEqual([2, 4, 6])
    expect(res?.errors).toHaveLength(0)
  })
  test('exceeding bulkMax throws', async () => {
    const mutate = async () => undefined
    const { result } = renderHook(() => useBulkMutate({ bulkMax: 2, defaultOnError, mutate, packageName: 'test' }))
    let captured: unknown
    try {
      await result.current.run([1, 2, 3])
    } catch (error) {
      captured = error
    }
    expect((captured as Error).message).toContain('exceeds maximum of 2')
  })
  test('partial failures collected in errors', async () => {
    const mutate = async (n: number) => {
      if (n === 2) throw new Error(`fail-${n}`)
      return n
    }
    const { result } = renderHook(() => useBulkMutate({ bulkMax: 10, defaultOnError, mutate, packageName: 'test' }))
    let res: undefined | { errors: unknown[]; results: number[] }
    await act(async () => {
      res = await result.current.run([1, 2, 3])
    })
    expect(res?.errors).toHaveLength(1)
    expect(res?.results.toSorted()).toEqual([1, 3])
  })
  test('onSuccess fires with succeeded count when all succeed', async () => {
    let count = -1
    const mutate = async () => undefined
    const onSuccess = (c: number) => {
      count = c
    }
    const { result } = renderHook(() =>
      useBulkMutate({ bulkMax: 10, defaultOnError, mutate, options: { onSuccess }, packageName: 'test' })
    )
    await act(async () => {
      await result.current.run([0, 0, 0, 0])
    })
    expect(count).toBe(4)
  })
})
