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
    fetchMovie: {
      get: unknown
      load: unknown
      refresh: unknown
    }
  }
}
const { api } = apiMod
describe('cacheCrud with fetcher (load + refresh actions)', () => {
  test('load fetches via fetcher when miss; subsequent load returns cacheHit', async () => {
    const tt = t()
    const first = (await tt.action(api.fetchMovie.load as never, { tmdb_id: 'fk' })) as {
      cacheHit: boolean
      title: string
    }
    expect(first.cacheHit).toBe(false)
    expect(first.title).toBe('hooked')
    const second = (await tt.action(api.fetchMovie.load as never, { tmdb_id: 'fk' })) as {
      cacheHit: boolean
    }
    expect(second.cacheHit).toBe(true)
  })
  test('refresh invalidates and re-fetches', async () => {
    const tt = t()
    await tt.action(api.fetchMovie.load as never, { tmdb_id: 'rf' })
    const r = (await tt.action(api.fetchMovie.refresh as never, { tmdb_id: 'rf' })) as {
      cacheHit: boolean
      title: string
    }
    expect(r.cacheHit).toBe(false)
  })
})
