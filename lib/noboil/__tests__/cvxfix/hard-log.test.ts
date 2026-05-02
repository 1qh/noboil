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
    hardLog: {
      append: unknown
      list: unknown
      pubIndexed: unknown
      purgeByParent: unknown
      rm: unknown
    }
  }
}
const { api } = apiMod
interface ListResult {
  page: { _id: string }[]
}
const seedUser = async (root: ReturnType<typeof t>): Promise<ReturnType<typeof t>> => {
  const userId = (await root.run(async ctx => ctx.db.insert('users', { name: 'seed' }))) as string
  return root.withIdentity({ subject: userId }) as never
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
const paginationOpts = { cursor: null, numItems: 50 }
describe('makeLog (hard-delete) integration', () => {
  test('rm by id hard-deletes (no softDelete)', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.hardLog.append, { parent: 'p', payload: { optionIdx: 0, voter: 'A' } })
    const before = (await callQuery(tt, api.hardLog.list, { paginationOpts, parent: 'p' })) as ListResult
    const id = before.page[0]?._id
    await callMutate(tt, api.hardLog.rm, { id })
    const after = (await callQuery(tt, api.hardLog.list, { paginationOpts, parent: 'p' })) as ListResult
    expect(after.page).toHaveLength(0)
  })
  test('pubIndexed exists when pub enabled and queries via by_parent index', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.hardLog.append, { parent: 'pi', payload: { optionIdx: 0, voter: 'A' } })
    const r = (await callQuery(tt, api.hardLog.pubIndexed, {
      index: 'by_parent',
      key: 'parent',
      value: 'pi'
    })) as { _id: string }[]
    expect(r.length).toBe(1)
  })
  test('purgeByParent without softDelete hard-deletes', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.hardLog.append, { parent: 'h', payload: { optionIdx: 0, voter: 'A' } })
    const result = (await callMutate(tt, api.hardLog.purgeByParent, { parent: 'h' })) as {
      deleted: number
      soft: boolean
    }
    expect(result.soft).toBe(false)
    expect(result.deleted).toBe(1)
  })
})
