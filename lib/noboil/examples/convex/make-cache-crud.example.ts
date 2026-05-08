/* eslint-disable @typescript-eslint/require-await */
import { number, object, string } from 'zod/v4'
import { makeCacheCrud } from '../../src/convex/server'
import { stubBuildersWithAction } from '../_stub'
const movieSchema = object({ overview: string(), title: string(), tmdbId: number() })
const movieCache = makeCacheCrud({
  builders: stubBuildersWithAction,
  fetcher: async (_ctx: unknown, id: unknown) => ({ overview: '', title: '', tmdbId: Number(id) }),
  key: 'tmdbId',
  schema: movieSchema,
  staleWhileRevalidate: true,
  table: 'movie',
  ttl: 24 * 60 * 60 * 1000
})
export { movieCache }
