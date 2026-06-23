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
  api: {
    'noboil-api': {
      create: unknown
      list: unknown
    }
  }
}
const api = apiMod.api['noboil-api']
const seedUser = async (root: ReturnType<typeof t>): Promise<ReturnType<typeof t>> => {
  const userId = (await root.run(async ctx => ctx.db.insert('users', { name: 'seed' }))) as string
  return root.withIdentity({ subject: userId }) as ReturnType<typeof t>
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
describe('noboil() helper integration', () => {
  test('noboil({ tables: ({ table }) => ({ tagItem: table(s.owned.tagItem) }) }) wires owned crud', async () => {
    const tt = await seedUser(t())
    const id = (await callMutate(tt, api.create, { label: 'first' })) as string
    expect(typeof id).toBe('string')
    const list = (await callQuery(tt, api.list, {
      paginationOpts: { cursor: null, numItems: 50 },
      where: { own: true }
    })) as { page: { _id: string; label: string }[] }
    expect(list.page).toHaveLength(1)
    expect(list.page[0]?.label).toBe('first')
  })
})
