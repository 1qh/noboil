/** biome-ignore-all lint/nursery/noComponentHookFactories: test fixture, not a component/hook */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof document === 'undefined') GlobalRegistrator.register()
const { renderHook } = await import('@testing-library/react')
const { describe, expect, test } = await import('bun:test')
const { createErrorToastHooks } = await import('../react/error-toast')
interface Code {
  code: string
  fieldErrors?: Record<string, string>
  message?: string
}
const helpers = {
  extractErrorData: (error: unknown): Code | undefined =>
    error && typeof error === 'object' && 'code' in error ? (error as Code) : undefined,
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : 'unknown'),
  handleError: (error: unknown, handlers: Record<string, unknown>) => {
    const data = helpers.extractErrorData(error)
    const handler = data?.code ? (handlers[data.code] as ((d: Code) => void) | undefined) : undefined
    if (handler && data) handler(data)
    else (handlers.default as ((e: unknown) => void) | undefined)?.(error)
  }
}
const hooks = createErrorToastHooks<Code>(helpers)
describe('createErrorToastHooks', () => {
  test('useErrorToast falls back to toast(message) when no specific handler', () => {
    const messages: string[] = []
    const toast = (m: string) => {
      messages.push(m)
    }
    const { result } = renderHook(() => hooks.useErrorToast({ toast }))
    result.current({ code: 'NOT_FOUND', message: 'item missing' })
    expect(messages).toEqual(['item missing'])
  })
  test('useErrorToast routes to handler when code matches', () => {
    const messages: string[] = []
    const handlers = {
      AUTH: () => {
        messages.push('handled-auth')
      }
    }
    const { result } = renderHook(() =>
      hooks.useErrorToast({
        handlers,
        toast: () => {
          /* Never called */
        }
      })
    )
    result.current({ code: 'AUTH' })
    expect(messages).toEqual(['handled-auth'])
  })
  test('useErrorToast falls through to toast for unstructured Error', () => {
    let toasted = ''
    const toast = (m: string) => {
      toasted = m
    }
    const { result } = renderHook(() => hooks.useErrorToast({ toast }))
    result.current(new Error('plain'))
    expect(toasted).toBe('plain')
  })
  test('makeErrorHandler returns a fn that uses overrides or toasts message', () => {
    const messages: string[] = []
    const toast = (m: string) => {
      messages.push(m)
    }
    let routed = ''
    const handler = hooks.makeErrorHandler(toast, {
      RATE_LIMIT: () => {
        routed = 'rl'
      }
    })
    handler({ code: 'RATE_LIMIT' })
    expect(routed).toBe('rl')
    expect(messages).toHaveLength(0)
    handler({ code: 'OTHER', message: 'oops' })
    expect(messages).toEqual(['oops'])
  })
  test('toastFieldError surfaces first field error when present', () => {
    let toasted = ''
    const toast = (m: string) => {
      toasted = m
    }
    const result = hooks.toastFieldError(
      { code: 'VALIDATION', fieldErrors: { email: 'invalid', name: 'required' } },
      toast
    )
    expect(result).toBe(true)
    expect(toasted).toBeTruthy()
  })
  test('toastFieldError returns false when no fieldErrors', () => {
    const result = hooks.toastFieldError({ code: 'X' }, () => {
      /* Never */
    })
    expect(result).toBe(false)
  })
  test('toastFieldError returns false when custom extractor returns nothing', () => {
    const result = hooks.toastFieldError(
      { code: 'X' },
      () => {
        /* Never */
      },
      () => undefined
    )
    expect(result).toBe(false)
  })
  test('toastFieldError uses custom extractor when provided', () => {
    let toasted = ''
    const result = hooks.toastFieldError(
      { something: 'first-field-msg' },
      m => {
        toasted = m
      },
      e => (e as { something: string }).something
    )
    expect(result).toBe(true)
    expect(toasted).toBe('first-field-msg')
  })
})
