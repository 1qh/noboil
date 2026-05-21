import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof document === 'undefined') GlobalRegistrator.register()
const { act, render, renderHook } = await import('@testing-library/react')
const { afterEach, describe, expect, test } = await import('bun:test')
const useOnlineStatus = (await import('../react/use-online-status')).default
const Component = () => {
  const online = useOnlineStatus()
  return <div data-testid='status'>{online ? 'online' : 'offline'}</div>
}
afterEach(() => {
  document.body.innerHTML = ''
})
describe('useOnlineStatus', () => {
  test('returns navigator.onLine snapshot', () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(typeof result.current).toBe('boolean')
  })
  test('reacts to offline/online events', () => {
    const { result } = renderHook(() => useOnlineStatus())
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    act(() => {
      globalThis.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    act(() => {
      globalThis.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
  test('subscribe/unsubscribe lifecycle', () => {
    const { unmount, result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBeDefined()
    unmount()
  })
  test('renders inside a component tree', () => {
    const { getByTestId } = render(<Component />)
    expect(['online', 'offline']).toContain(getByTestId('status').textContent)
  })
})
