/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/** Builder stubs used inside `*.example.ts` files. Provide values that satisfy the real factory types
 * without pulling in the convex/spacetimedb runtime. They never execute — these files exist to lock
 * the public API surface to compile-time checks.
 *
 * Stub values are typed `never` so the TypeScript checker can hand them to any parameter slot
 * without widening to `any` or punching unsafe holes. The runtime payloads are unreachable.
 */
const stub = (() => undefined) as never
const stubBuilders = { cm: stub, cq: stub, m: stub, pq: stub, q: stub } as never
const stubBuildersWithAction = {
  action: stub,
  cm: stub,
  cq: stub,
  internalMutation: stub,
  internalQuery: stub,
  m: stub,
  mutation: stub,
  pq: stub,
  q: stub,
  query: stub
} as never
const stubSpacetime = { reducer: stub } as never
const stubField = stub
const stubTable = stub
const stubPk = stub
export { stub, stubBuilders, stubBuildersWithAction, stubField, stubPk, stubSpacetime, stubTable }
