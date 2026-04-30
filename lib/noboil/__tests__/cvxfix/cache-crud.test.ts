import { Glob } from 'bun'
import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import { resolve } from 'node:path'
import schema from './convex/schema'
const cvxDir = resolve(import.meta.dir, 'convex')
const loadModules = () => {
  const out: Record<string, () => Promise<Record<string, unknown>>> = {}
  const glob = new Glob('**/*.ts')
  for (const rel of glob.scanSync({ cwd: cvxDir }))
    out[`../convex/${rel.replace(/\.ts$/u, '.js')}`] = async () =>
      (await import(`${cvxDir}/${rel}`)) as Record<string, unknown>
  return out
}
const t = () => convexTest(schema, loadModules())
const apiMod = (await import('./convex/_generated/api')) as {
  api: {
    movies: {
      all: unknown
      create: unknown
      get: unknown
      invalidate: unknown
      list: unknown
      read: unknown
      rm: unknown
      update: unknown
    }
  }
}
const { api } = apiMod
interface MovieDoc {
  _id: string
  cacheHit?: boolean
  rating: number
  stale?: boolean
  title: string
  tmdb_id: string
  updatedAt?: number
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
const paginationOpts = { cursor: null, numItems: 50 }
describe('makeCacheCrud integration', () => {
  test('create + get returns cached row', async () => {
    const tt = t()
    await callMutate(tt, api.movies.create, { rating: 8, title: 'Matrix', tmdb_id: 't1' })
    const got = (await callQuery(tt, api.movies.get, { tmdb_id: 't1' })) as MovieDoc
    expect(got.title).toBe('Matrix')
    expect(got.cacheHit).toBe(true)
  })
  test('get on missing key returns null', async () => {
    const tt = t()
    const r = await callQuery(tt, api.movies.get, { tmdb_id: 'nope' })
    expect(r).toBeNull()
  })
  test('all returns all valid rows', async () => {
    const tt = t()
    await callMutate(tt, api.movies.create, { rating: 7, title: 'A', tmdb_id: 'a' })
    await callMutate(tt, api.movies.create, { rating: 9, title: 'B', tmdb_id: 'b' })
    const rows = (await callQuery(tt, api.movies.all, {})) as MovieDoc[]
    expect(rows).toHaveLength(2)
  })
  test('list returns paginated valid rows', async () => {
    const tt = t()
    await callMutate(tt, api.movies.create, { rating: 6, title: 'L1', tmdb_id: 'l1' })
    await callMutate(tt, api.movies.create, { rating: 7, title: 'L2', tmdb_id: 'l2' })
    const result = (await callQuery(tt, api.movies.list, { paginationOpts })) as { isDone: boolean; page: MovieDoc[] }
    expect(result.page).toHaveLength(2)
  })
  test('update mutates cached row', async () => {
    const tt = t()
    await callMutate(tt, api.movies.create, { rating: 5, title: 'OldTitle', tmdb_id: 'u1' })
    const initial = (await callQuery(tt, api.movies.get, { tmdb_id: 'u1' })) as MovieDoc
    await callMutate(tt, api.movies.update, { id: initial._id, title: 'NewTitle' })
    const after = (await callQuery(tt, api.movies.read, { id: initial._id })) as MovieDoc
    expect(after.title).toBe('NewTitle')
  })
  test('create with same key updates existing row (upsert path)', async () => {
    const tt = t()
    await callMutate(tt, api.movies.create, { rating: 5, title: 'V1', tmdb_id: 'same' })
    await callMutate(tt, api.movies.create, { rating: 9, title: 'V2', tmdb_id: 'same' })
    const got = (await callQuery(tt, api.movies.get, { tmdb_id: 'same' })) as MovieDoc
    expect(got.title).toBe('V2')
    expect(got.rating).toBe(9)
    const all = (await callQuery(tt, api.movies.all, {})) as MovieDoc[]
    expect(all.filter(m => m.tmdb_id === 'same')).toHaveLength(1)
  })
  test('invalidate marks key stale', async () => {
    const tt = t()
    await callMutate(tt, api.movies.create, { rating: 7, title: 'I', tmdb_id: 'inv' })
    await callMutate(tt, api.movies.invalidate, { tmdb_id: 'inv' })
    const r = await callQuery(tt, api.movies.get, { tmdb_id: 'inv' })
    expect(r).toBeNull()
  })
})
