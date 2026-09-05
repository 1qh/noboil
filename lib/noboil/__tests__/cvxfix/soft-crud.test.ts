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
  api: {
    softTodos: {
      create: unknown
      list: unknown
      restore: unknown
      rm: unknown
    }
  }
}
const { api } = apiMod
interface ListResult {
  page: TodoDoc[]
}
interface TodoDoc {
  _id: string
  deletedAt?: number
  done: boolean
  title: string
  userId: string
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
describe('makeCrud (owned, softDelete) integration', () => {
  test('rm soft-deletes; restore brings back', async () => {
    const tt = await seedUser(t())
    const id = (await callMutate(tt, api.softTodos.create, { done: false, title: 'soft' })) as string
    await callMutate(tt, api.softTodos.rm, { id })
    const empty = (await callQuery(tt, api.softTodos.list, {
      paginationOpts,
      where: { own: true }
    })) as ListResult
    expect(empty.page).toHaveLength(0)
    await callMutate(tt, api.softTodos.restore, { id })
    const restored = (await callQuery(tt, api.softTodos.list, {
      paginationOpts,
      where: { own: true }
    })) as ListResult
    expect(restored.page).toHaveLength(1)
  })
  test('rm of non-existent id returns NOT_FOUND', async () => {
    const tt = await seedUser(t())
    const id = (await callMutate(tt, api.softTodos.create, { done: false, title: 'x' })) as string
    await callMutate(tt, api.softTodos.rm, { id })
    await tt.run(async ctx => ctx.db.delete(id as never))
    await expect(callMutate(tt, api.softTodos.rm, { id })).rejects.toThrow()
  })
  test('bulk soft-rm via ids', async () => {
    const tt = await seedUser(t())
    const a = (await callMutate(tt, api.softTodos.create, { done: false, title: 'a' })) as string
    const b = (await callMutate(tt, api.softTodos.create, { done: false, title: 'b' })) as string
    await callMutate(tt, api.softTodos.rm, { ids: [a, b] })
    const list = (await callQuery(tt, api.softTodos.list, { paginationOpts, where: { own: true } })) as ListResult
    expect(list.page).toHaveLength(0)
  })
})
