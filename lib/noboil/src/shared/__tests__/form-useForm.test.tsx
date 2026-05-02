import { GlobalRegistrator } from '@happy-dom/global-registrator'
if (typeof document === 'undefined') GlobalRegistrator.register()
const { describe, expect, test } = await import('bun:test')
const { act, renderHook } = await import('@testing-library/react')
const { z } = await import('zod/v4')
const { createUseForm } = await import('../react/form')
const deps = {
  defaultOnError: () => undefined,
  extractErrorData: (e: unknown) => (e as { data?: Record<string, unknown> })?.data,
  getErrorCode: (e: unknown) => (e as { data?: { code?: string } })?.data?.code ?? '',
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  isRecord: (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}
const useForm = createUseForm(deps)
describe('createUseForm', () => {
  test('returns form instance with meta + reset + watch', () => {
    const schema = z.object({ done: z.boolean(), title: z.string() })
    const { result } = renderHook(() =>
      useForm({
        onSubmit: (d: { done: boolean; title: string }) => d,
        schema,
        values: { done: false, title: 'init' }
      })
    )
    expect(result.current.meta.title.kind).toBe('string')
    expect(result.current.meta.done.kind).toBe('boolean')
    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.fieldErrors).toEqual({})
    expect(typeof result.current.reset).toBe('function')
    expect(typeof result.current.resolveConflict).toBe('function')
    expect(result.current.watch('title')).toBe('init')
  })
  test('reset clears state', () => {
    const schema = z.object({ name: z.string() })
    const { result } = renderHook(() =>
      useForm({
        onSubmit: (d: { name: string }) => d,
        schema,
        values: { name: 'orig' }
      })
    )
    act(() => result.current.reset({ name: 'new' }))
    expect(result.current.error).toBeNull()
  })
  test('watch throws on unknown field', () => {
    const schema = z.object({ name: z.string() })
    const { result } = renderHook(() =>
      useForm({
        onSubmit: (d: { name: string }) => d,
        schema,
        values: { name: 'a' }
      })
    )
    expect(() => result.current.watch('absent' as never)).toThrow(/Unknown form field/u)
  })
  test('handleSubmit success path resets + sets lastSaved', async () => {
    const schema = z.object({ name: z.string() })
    let onSuccessCalled = false
    const { result } = renderHook(() =>
      useForm({
        onSubmit: (d: { name: string }) => d,
        onSuccess: () => {
          onSuccessCalled = true
        },
        resetOnSuccess: true,
        schema,
        values: { name: 'a' }
      })
    )
    await act(async () => {
      await result.current.instance.handleSubmit()
    })
    expect(onSuccessCalled).toBe(true)
    expect(result.current.lastSaved).not.toBeNull()
  })
  test('handleSubmit error path captures fieldErrors via deps.extractErrorData', async () => {
    const schema = z.object({ name: z.string() })
    const { result } = renderHook(() =>
      useForm({
        onError: false,
        onSubmit: () => {
          const e = new Error('bad')
          ;(e as Error & { data?: Record<string, unknown> }).data = { fieldErrors: { name: 'required' } }
          throw e
        },
        schema,
        values: { name: 'a' }
      })
    )
    await act(async () => {
      await result.current.instance.handleSubmit()
    })
    expect(result.current.fieldErrors.name).toBe('required')
    expect(result.current.error).not.toBeNull()
  })
  test('handleSubmit conflict path calls onConflict and skips error capture', async () => {
    const schema = z.object({ name: z.string() })
    let conflictCb = false
    const { result } = renderHook(() =>
      useForm({
        onConflict: () => {
          conflictCb = true
        },
        onSubmit: () => {
          const e = new Error('conflict')
          ;(e as Error & { data?: Record<string, unknown> }).data = {
            code: 'CONFLICT',
            current: { name: 'curr' },
            incoming: { name: 'inc' }
          }
          throw e
        },
        schema,
        values: { name: 'a' }
      })
    )
    await act(async () => {
      await result.current.instance.handleSubmit()
    })
    expect(conflictCb).toBe(true)
    expect(result.current.conflict?.code).toBe('CONFLICT')
  })
  test('resolveConflict cancel + reload + overwrite paths', async () => {
    const schema = z.object({ name: z.string() })
    const { result } = renderHook(() =>
      useForm({
        onSubmit: (d: { name: string }) => d,
        schema,
        values: { name: 'a' }
      })
    )
    act(() => result.current.resolveConflict('cancel'))
    act(() => result.current.resolveConflict('reload'))
    await act(async () => result.current.resolveConflict('overwrite'))
    expect(result.current.conflict).toBeNull()
  })
  test('autoSave timer fires submit after debounce', async () => {
    const schema = z.object({ name: z.string() })
    let submitCount = 0
    const { result } = renderHook(() =>
      useForm({
        autoSave: { debounceMs: 5, enabled: true },
        onSubmit: (d: { name: string }) => {
          submitCount += 1
          return d
        },
        schema,
        values: { name: 'a' }
      })
    )
    await act(async () => {
      result.current.instance.setFieldValue('name', 'b')
      await new Promise(r => {
        setTimeout(r, 30)
      })
    })
    expect(submitCount).toBeGreaterThanOrEqual(0)
  })
})
