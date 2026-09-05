/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof document === 'undefined') GlobalRegistrator.register()
const { act, renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { useSoftDelete } = await import('../react/use-soft-delete')
describe('useSoftDelete (shared)', () => {
  test('remove calls rm and triggers toast with Undo action', async () => {
    let rmCalls = 0
    let toastedMessage = ''
    let toastedAction: undefined | { label: string; onClick: () => void }
    const rm = async () => {
      rmCalls += 1
    }
    const restore = async () => undefined
    const toast = (message: string, opts?: { action?: { label: string; onClick: () => void } }) => {
      toastedMessage = message
      toastedAction = opts?.action
    }
    const { result } = renderHook(() => useSoftDelete({ label: 'todo', restore, rm, toast, undoMs: 1000 }))
    await act(async () => {
      await result.current.remove({ id: 'x' })
    })
    expect(rmCalls).toBe(1)
    expect(toastedMessage).toContain('deleted')
    expect(toastedAction?.label).toBe('Undo')
  })
  test('Undo onClick invokes restore + onRestore + toasts', async () => {
    let restoreCalls = 0
    let onRestoreCount = 0
    const messages: string[] = []
    const restore = async () => {
      restoreCalls += 1
    }
    const rm = async () => undefined
    const onRestore = () => {
      onRestoreCount += 1
    }
    let undoClick: (() => void) | undefined
    const captureToast = (m: string, opts?: { action?: { label: string; onClick: () => void } }) => {
      messages.push(m)
      undoClick = opts?.action?.onClick
    }
    const { result } = renderHook(() => useSoftDelete({ onRestore, restore, rm, toast: captureToast, undoMs: 1000 }))
    await act(async () => {
      await result.current.remove({ id: 'a' })
    })
    expect(undoClick).toBeDefined()
    await act(async () => {
      undoClick?.()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(restoreCalls).toBe(1)
    expect(onRestoreCount).toBe(1)
    expect(messages.some(m => m.includes('restored'))).toBe(true)
  })
  test('Undo failure routes through onError when provided', async () => {
    let captured: unknown
    const restore = async () => {
      throw new Error('restore-fail')
    }
    const rm = async () => undefined
    const toast = (_m: string, opts?: { action?: { onClick: () => void } }) => {
      opts?.action?.onClick()
    }
    const onError = (e: unknown) => {
      captured = e
    }
    const { result } = renderHook(() => useSoftDelete({ onError, restore, rm, toast, undoMs: 1000 }))
    await act(async () => {
      await result.current.remove({ id: 'a' })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect((captured as Error).message).toBe('restore-fail')
  })
})
