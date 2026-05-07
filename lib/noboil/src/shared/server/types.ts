/** Shared server-side types used by both convex + spacetimedb backends. */
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
export type { RateLimitConfig, RateLimitInput, SearchLike, StorageLike }
