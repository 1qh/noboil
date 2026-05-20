import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof document === 'undefined') GlobalRegistrator.register()
const { act, renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { useOptimisticMutation } = await import('../react/use-optimistic')
describe('useOptimisticMutation (shared)', () => {
  test('initial state: not pending, no error', () => {
    const mutate = async () => 'ok'
    const { result } = renderHook(() => useOptimisticMutation({ mutate }))
    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBeNull()
  })
  test('execute calls onOptimistic before mutate, onSuccess after', async () => {
    const order: string[] = []
    const mutate = async () => {
      order.push('mutate')
      return 'r'
    }
    const onOptimistic = () => {
      order.push('opt')
    }
    const onSuccess = () => {
      order.push('ok')
    }
    const { result } = renderHook(() => useOptimisticMutation({ mutate, onOptimistic, onSuccess }))
    await act(async () => {
      await result.current.execute({})
    })
    expect(order).toEqual(['opt', 'mutate', 'ok'])
  })
  test('execute on error: error state set + onRollback called', async () => {
    let rollbackArgs: null | { x: number } = null
    const mutate = async () => {
      throw new Error('boom')
    }
    const onRollback = (args: { x: number }) => {
      rollbackArgs = args
    }
    const { result } = renderHook(() => useOptimisticMutation({ mutate, onRollback }))
    await act(async () => {
      const r = await result.current.execute({ x: 7 })
      expect(r).toBeNull()
    })
    expect(result.current.error?.message).toBe('boom')
    expect(rollbackArgs as unknown).toEqual({ x: 7 })
  })
  test('non-Error throws are wrapped into Error', async () => {
    const mutate = async () => {
      throw new Error('string-fail')
    }
    const { result } = renderHook(() => useOptimisticMutation({ mutate }))
    await act(async () => {
      await result.current.execute({})
    })
    expect(result.current.error).toBeInstanceOf(Error)
  })
  test('onSettled fires on success with result', async () => {
    let settled: null | { error: unknown; value?: string } = null
    const mutate = async () => 'done'
    const onSettled = (_a: unknown, error: unknown, value?: string) => {
      settled = { error, value }
    }
    const { result } = renderHook(() => useOptimisticMutation({ mutate, onSettled }))
    await act(async () => {
      await result.current.execute({})
    })
    expect(settled as unknown).toEqual({ error: undefined, value: 'done' })
  })
})
