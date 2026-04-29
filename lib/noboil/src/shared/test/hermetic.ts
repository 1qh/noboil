type HermeticHandler = (op: string, payload: unknown) => unknown
let adapter: HermeticHandler | null = null
/** Install (or clear) a test-time adapter that intercepts external HTTP / LLM / sandbox ops. */
const setHermeticAdapter = (h: HermeticHandler | null): void => {
  adapter = h
}
/** Try to handle `(op, payload)` via the installed hermetic adapter; returns `undefined` if none. */
const hermeticTry = (op: string, payload: unknown): unknown => {
  if (!adapter) return
  return adapter(op, payload)
}
export type { HermeticHandler }
export { hermeticTry, setHermeticAdapter }
