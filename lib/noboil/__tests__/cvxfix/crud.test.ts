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
    todos: {
      create: unknown
      list: unknown
      pubIndexed: unknown
      read: unknown
      rm: unknown
      update: unknown
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
  updatedAt: number
  userId: string
}
const seedUser = async (root: ReturnType<typeof t>): Promise<{ tt: ReturnType<typeof t>; userId: string }> => {
  const userId = (await root.run(async ctx => ctx.db.insert('users', { name: 'seed' }))) as string
  return { tt: root.withIdentity({ subject: userId }) as never, userId }
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
const paginationOpts = { cursor: null, numItems: 50 }
describe('makeCrud (owned) integration', () => {
  test('create returns id; read returns full doc', async () => {
    const { tt } = await seedUser(t())
    const id = (await callMutate(tt, api.todos.create, { done: false, title: 'first' })) as string
    expect(typeof id).toBe('string')
    const fetched = (await callQuery(tt, api.todos.read, { id })) as TodoDoc
    expect(fetched.title).toBe('first')
    expect(fetched.done).toBe(false)
  })
  test('list returns rows for the calling user with own:true filter', async () => {
    const { tt } = await seedUser(t())
    await callMutate(tt, api.todos.create, { done: false, title: 'a' })
    await callMutate(tt, api.todos.create, { done: true, title: 'b' })
    const listed = (await callQuery(tt, api.todos.list, { paginationOpts, where: { own: true } })) as ListResult
    expect(listed.page).toHaveLength(2)
  })
  test('update with shape {id, title?, done?} mutates row', async () => {
    const { tt } = await seedUser(t())
    const id = (await callMutate(tt, api.todos.create, { done: false, title: 'orig' })) as string
    await callMutate(tt, api.todos.update, { done: true, id, title: 'updated' })
    const got = (await callQuery(tt, api.todos.read, { id })) as TodoDoc
    expect(got.title).toBe('updated')
    expect(got.done).toBe(true)
  })
  test('rm hard-deletes when soft-delete disabled', async () => {
    const { tt } = await seedUser(t())
    const id = (await callMutate(tt, api.todos.create, { done: false, title: 'x' })) as string
    await callMutate(tt, api.todos.rm, { id })
    const afterRm = (await callQuery(tt, api.todos.list, { paginationOpts, where: { own: true } })) as ListResult
    expect(afterRm.page).toHaveLength(0)
  })
  test('bulk create via items inserts many', async () => {
    const { tt } = await seedUser(t())
    const result = (await callMutate(tt, api.todos.create, {
      items: [
        { done: false, title: 'a' },
        { done: true, title: 'b' },
        { done: false, title: 'c' }
      ]
    })) as string[]
    expect(result).toHaveLength(3)
    const listed = (await callQuery(tt, api.todos.list, { paginationOpts, where: { own: true } })) as ListResult
    expect(listed.page).toHaveLength(3)
  })
  test('bulk rm via ids removes many', async () => {
    const { tt } = await seedUser(t())
    const a = (await callMutate(tt, api.todos.create, { done: false, title: 'a' })) as string
    const b = (await callMutate(tt, api.todos.create, { done: false, title: 'b' })) as string
    await callMutate(tt, api.todos.create, { done: false, title: 'keep' })
    await callMutate(tt, api.todos.rm, { ids: [a, b] })
    const remaining = (await callQuery(tt, api.todos.list, { paginationOpts, where: { own: true } })) as ListResult
    expect(remaining.page).toHaveLength(1)
    expect(remaining.page[0]?.title).toBe('keep')
  })
  test('list with where filter on done field', async () => {
    const { tt } = await seedUser(t())
    await callMutate(tt, api.todos.create, { done: false, title: 'pending' })
    await callMutate(tt, api.todos.create, { done: true, title: 'finished' })
    const onlyDone = (await callQuery(tt, api.todos.list, {
      paginationOpts,
      where: { done: true, own: true }
    })) as ListResult
    expect(onlyDone.page).toHaveLength(1)
    expect(onlyDone.page[0]?.title).toBe('finished')
  })
  test('list with where or-clause (multi-group) widens match', async () => {
    const { tt } = await seedUser(t())
    await callMutate(tt, api.todos.create, { done: true, title: 'A' })
    await callMutate(tt, api.todos.create, { done: false, title: 'B' })
    const listed = (await callQuery(tt, api.todos.list, {
      paginationOpts,
      where: { done: true, or: [{ done: false, own: true }], own: true }
    })) as ListResult
    expect(listed.page.length).toBeGreaterThanOrEqual(2)
  })
  test('pubIndexed queries via by_user index', async () => {
    const root = t()
    const { tt, userId } = await seedUser(root)
    await callMutate(tt, api.todos.create, { done: false, title: 'a' })
    await callMutate(tt, api.todos.create, { done: true, title: 'b' })
    const docs = (await callQuery(root, api.todos.pubIndexed, {
      index: 'by_user',
      key: 'userId',
      value: userId
    })) as TodoDoc[]
    expect(docs.length).toBe(2)
  })
  test('bulk update via items[] applies all patches', async () => {
    const { tt } = await seedUser(t())
    const a = (await callMutate(tt, api.todos.create, { done: false, title: 'A' })) as string
    const b = (await callMutate(tt, api.todos.create, { done: false, title: 'B' })) as string
    await callMutate(tt, api.todos.update, {
      items: [
        { done: true, id: a },
        { done: true, id: b, title: 'B2' }
      ]
    })
    const all = (await callQuery(tt, api.todos.list, { paginationOpts, where: { own: true } })) as ListResult
    expect(all.page.every(r => r.done)).toBe(true)
    expect(all.page.find(r => r.title === 'B2')).toBeDefined()
  })
  test('read with own:true returns null when viewer is not the owner', async () => {
    const root = t()
    const { tt: tt1 } = await seedUser(root)
    const { tt: tt2 } = await seedUser(root)
    const id = (await callMutate(tt1, api.todos.create, { done: false, title: 'mine' })) as string
    const got = await callQuery(tt2, api.todos.read, { id, own: true })
    expect(got).toBeNull()
  })
  test('list with own:true scopes to authenticated user', async () => {
    const root = t()
    const { tt: tt1 } = await seedUser(root)
    const { tt: tt2 } = await seedUser(root)
    await callMutate(tt1, api.todos.create, { done: false, title: 'mine' })
    await callMutate(tt2, api.todos.create, { done: false, title: 'theirs' })
    const u1 = (await callQuery(tt1, api.todos.list, { paginationOpts, where: { own: true } })) as ListResult
    expect(u1.page).toHaveLength(1)
    expect(u1.page[0]?.title).toBe('mine')
  })
})
