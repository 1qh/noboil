import type { CacheBuilders } from '../../../src/convex/server/types'
import { makeCacheCrud } from '../../../src/convex/server/cache-crud'
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { cm, cq } from './auth-builders'
import { movieSchema } from './s'

const builders = {
  action,
  cm,
  cq,
  internalMutation,
  internalQuery,
  mutation,
  query
} as unknown as CacheBuilders
const endpoints = makeCacheCrud({
  builders,
  fetcher: async (_c, key) => ({
    rating: 99,
    title: `fetched-${String(key)}`,
    tmdb_id: String(key)
  }),
  hooks: {
    afterCreate: () => undefined,
    afterDelete: () => undefined,
    afterUpdate: () => undefined,
    beforeCreate: (_c, a) => a.data,
    beforeDelete: () => undefined,
    beforeUpdate: (_c, a) => a.patch,
    onFetch: data => ({ ...(data as Record<string, unknown>), title: 'hooked' })
  },
  key: 'tmdb_id',
  rateLimit: { max: 100, window: 60_000 },
  schema: movieSchema,
  staleWhileRevalidate: true,
  table: 'fetchMovie',
  ttl: 60_000
})
export const { all, checkRL, create, get, getInternal, invalidate, list, load, purge, read, refresh, rm, set, update } =
  endpoints
