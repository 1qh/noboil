/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { Glob } from 'bun'
import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import { resolve } from 'node:path'
import schema from './convex/schema'

const cvxDir = resolve(import.meta.dir, 'convex')
const loadModules = () => {
  const out: Record<string, () => Promise<Record<string, unknown>>> = {}
  const glob = new Glob('**/*.ts')
  // oxlint-disable-next-line node/no-sync
  for (const rel of glob.scanSync({ cwd: cvxDir }))
    out[`../convex/${rel.replace(/\.ts$/u, '.js')}`] = async () =>
      (await import(`${cvxDir}/${rel}`)) as Record<string, unknown>
  return out
}
const t = () => convexTest(schema, loadModules())
const apiMod = (await import('./convex/_generated/api')) as {
  api: { kvs: { get: unknown; list: unknown; restore: unknown; rm: unknown; set: unknown } }
}
const { api } = apiMod
interface KvDoc {
  _id: string
  active: boolean
  deletedAt?: number
  key: string
  message: string
  updatedAt: number
}
interface ListResult {
  page: KvDoc[]
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown>): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown>): Promise<unknown> =>
  tt.query(fn as never, args)
describe('makeKv integration', () => {
  test('set creates a key, get reads it, list paginates', async () => {
    const tt = t()
    await callMutate(tt, api.kvs.set, { key: 'banner', payload: { active: true, message: 'hello' } })
    const got = (await callQuery(tt, api.kvs.get, { key: 'banner' })) as KvDoc
    expect(got.message).toBe('hello')
    expect(got.active).toBe(true)
    const listed = (await callQuery(tt, api.kvs.list, { paginationOpts: { cursor: null, numItems: 10 } })) as ListResult
    expect(listed.page).toHaveLength(1)
    expect(listed.page[0]?.key).toBe('banner')
  })
  test('set overwrites existing key + bumps updatedAt', async () => {
    const tt = t()
    await callMutate(tt, api.kvs.set, { key: 'k', payload: { active: false, message: 'v1' } })
    const before = (await callQuery(tt, api.kvs.get, { key: 'k' })) as KvDoc
    await callMutate(tt, api.kvs.set, { key: 'k', payload: { active: true, message: 'v2' } })
    const after = (await callQuery(tt, api.kvs.get, { key: 'k' })) as KvDoc
    expect(after.message).toBe('v2')
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt)
  })
  test('rm soft-deletes; restore brings it back', async () => {
    const tt = t()
    await callMutate(tt, api.kvs.set, { key: 'x', payload: { active: true, message: 'm' } })
    await callMutate(tt, api.kvs.rm, { key: 'x' })
    const afterRm = await callQuery(tt, api.kvs.get, { key: 'x' })
    expect(afterRm).toBeNull()
    await callMutate(tt, api.kvs.restore, { key: 'x' })
    const afterRestore = (await callQuery(tt, api.kvs.get, { key: 'x' })) as KvDoc
    expect(afterRestore.message).toBe('m')
  })
  test('writeRole function returning true allows writes', async () => {
    const tt = t()
    await tt.mutation((api as { kvs: { setAllowed: unknown } }).kvs.setAllowed as never, {
      key: 'roleyes',
      payload: { active: true, message: 'go' }
    })
    const r = (await callQuery(tt, api.kvs.get, { key: 'roleyes' })) as KvDoc
    expect(r.message).toBe('go')
  })
  test('writeRole function returning false rejects writes', async () => {
    const tt = t()
    await expect(
      tt.mutation((api as { kvs: { setDenied: unknown } }).kvs.setDenied as never, {
        key: 'roleno',
        payload: { active: false, message: 'no' }
      })
    ).rejects.toThrow('FORBIDDEN')
  })
  test('keys allowlist rejects unknown key', async () => {
    const tt = t()
    await expect(
      callMutate(tt, api.kvs.set, { key: 'notInList', payload: { active: true, message: 'x' } })
    ).rejects.toThrow('INVALID_KEY')
  })
  test('get on missing key returns null', async () => {
    const tt = t()
    const r = await callQuery(tt, api.kvs.get, { key: 'never' })
    expect(r).toBeNull()
  })
})
