import type { FilterLike, IndexLike, SearchLike } from './types'
/** Type-bridge for index builders — coerces our typed `IndexLike` fn to Convex's untyped slot. Internal. */
const idx = (fn: (ib: IndexLike) => IndexLike): never => fn as never
/** Type-bridge for filter builders — coerces our typed `FilterLike` fn to Convex's untyped slot. Internal. */
const flt = (fn: (fb: FilterLike) => unknown): never => fn as never
/** Type-bridge for search-index builders — coerces our typed `SearchLike` fn to Convex's untyped slot. Internal. */
const sch = (fn: (sb: SearchLike) => unknown): never => fn as never
/** Type-bridge: erase a typed value to `never` for assignment into Convex's loosely-typed APIs. Internal. */
const typed = (value: unknown): never => value as never
/** Build an index-fields tuple typed for Convex's `index('name', [...fields])`. Internal. */
const indexFields = (...fields: string[]): never => fields as never
export { flt, idx, indexFields, sch, typed }
