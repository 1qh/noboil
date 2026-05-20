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
  key: 'tmdb_id',
  schema: movieSchema,
  table: 'movie'
})
export const { all, create, get, getInternal, invalidate, list, purge, read, rm, set, update } = endpoints
