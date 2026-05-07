/** Shared fake fixtures for stdb server reducer tests. Pure helpers — no runtime side effects. */
interface IdentityFake {
  __id: string
  isEqual: (o: unknown) => boolean
}
interface Ts {
  microsSinceUnixEpoch: bigint
}
const ident = (label: string) =>
  ({ __id: label, isEqual: (o: unknown) => (o as { __id?: string }).__id === label }) as never
const tsAtMs = (ms: number) => ({ microsSinceUnixEpoch: BigInt(ms) * 1000n }) as never
const captureReducers = () => {
  const out: Record<string, unknown> = {}
  const reducer = (opts: { name: string }, _params: unknown, fn: unknown) => {
    out[opts.name] = fn
    return fn
  }
  return { reducer, reducers: out }
}
export type { IdentityFake, Ts }
export { captureReducers, ident, tsAtMs }
