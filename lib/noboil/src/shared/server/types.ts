/** Shared server-side types used by both convex + spacetimedb backends. */
interface AuthorInfo {
  [key: string]: unknown
  email?: string
  image?: string
  name?: string
}
interface ComparisonOp<V> {
  $between?: [V, V]
  $gt?: V
  $gte?: V
  $lt?: V
  $lte?: V
}
interface PaginatedResult<D> {
  continueCursor: string
  isDone: boolean
  page: D[]
}
interface RateLimitConfig {
  max: number
  window: number
}
type RateLimitInput = number | RateLimitConfig
interface SearchLike {
  search: (field: string, query: string) => unknown
}
interface StorageLike {
  delete: (id: string) => Promise<void>
  getUrl: (id: string) => Promise<null | string>
}
export type { AuthorInfo, ComparisonOp, PaginatedResult, RateLimitConfig, RateLimitInput, SearchLike, StorageLike }
