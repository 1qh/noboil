const realDateNow = Date.now.bind(Date)
/** Pin `Date.now()` to a fixed millisecond timestamp. Use in tests for deterministic timing. */
const setNow = (ms: number): void => {
  Date.now = (): number => ms
}
/** Restore the real `Date.now()`. Always pair with `setNow` in `afterEach` to avoid bleed. */
const restoreNow = (): void => {
  Date.now = realDateNow
}
/** Move the pinned `Date.now()` forward by `deltaMs`. Useful for testing TTL / quota windows. */
const advanceNow = (deltaMs: number): void => {
  const cur = Date.now()
  setNow(cur + deltaMs)
}
/** Run `fn` with `Date.now()` pinned to `ms`; restores automatically (even on throw). */
const withFakeNow = async <T>(ms: number, fn: () => Promise<T> | T): Promise<T> => {
  setNow(ms)
  try {
    return await fn()
  } finally {
    restoreNow()
  }
}
export { advanceNow, restoreNow, setNow, withFakeNow }
