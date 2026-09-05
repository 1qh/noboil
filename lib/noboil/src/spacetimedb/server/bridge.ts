/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
const idx = (fn: (ib: unknown) => unknown): never => fn as never
const flt = (fn: (fb: unknown) => unknown): never => fn as never
const sch = (fn: (sb: unknown) => unknown): never => fn as never
const typed = (value: unknown): never => value as never
const indexFields = (...fields: string[]): never => fields as never
export { flt, idx, indexFields, sch, typed }
