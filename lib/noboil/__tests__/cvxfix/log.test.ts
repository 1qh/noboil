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
    votes: {
      append: unknown
      authIndexed: unknown
      list: unknown
      listAfter: unknown
      purgeByParent: unknown
      read: unknown
      restoreByParent: unknown
      rm: unknown
      update: unknown
    }
  }
}
const { api } = apiMod
interface ListResult {
  page: VoteDoc[]
}
interface VoteDoc {
  _id: string
  deletedAt?: number
  optionIdx: number
  parent: string
  seq: number
  voter: string
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
describe('makeLog integration', () => {
  test('append + list', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, { parent: 'poll-1', payload: { optionIdx: 0, voter: 'A' } })
    await callMutate(tt, api.votes.append, { parent: 'poll-1', payload: { optionIdx: 1, voter: 'B' } })
    const listed = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'poll-1' })) as ListResult
    expect(listed.page).toHaveLength(2)
  })
  test('append with items=[] inserts many', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, {
      items: [
        { optionIdx: 0, voter: 'A' },
        { optionIdx: 1, voter: 'B' },
        { optionIdx: 0, voter: 'C' }
      ],
      parent: 'poll-2'
    })
    const listed = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'poll-2' })) as ListResult
    expect(listed.page).toHaveLength(3)
  })
  test('purgeByParent soft-deletes; restoreByParent brings back', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, { parent: 'poll-3', payload: { optionIdx: 0, voter: 'A' } })
    await callMutate(tt, api.votes.purgeByParent, { parent: 'poll-3' })
    const empty = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'poll-3' })) as ListResult
    expect(empty.page).toHaveLength(0)
    await callMutate(tt, api.votes.restoreByParent, { parent: 'poll-3' })
    const restored = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'poll-3' })) as ListResult
    expect(restored.page).toHaveLength(1)
  })
  test('rm by id removes a single row', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, { parent: 'rm-me', payload: { optionIdx: 0, voter: 'A' } })
    const before = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'rm-me' })) as ListResult
    expect(before.page).toHaveLength(1)
    const id = before.page[0]?._id
    await callMutate(tt, api.votes.rm, { id })
    const after = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'rm-me' })) as ListResult
    expect(after.page).toHaveLength(0)
  })
  test('rm bulk via ids removes many', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, {
      items: [
        { optionIdx: 0, voter: 'A' },
        { optionIdx: 0, voter: 'B' },
        { optionIdx: 0, voter: 'C' }
      ],
      parent: 'bulk-rm'
    })
    const all = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'bulk-rm' })) as ListResult
    const ids = all.page.map(r => r._id)
    await callMutate(tt, api.votes.rm, { ids: ids.slice(0, 2) })
    const remaining = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'bulk-rm' })) as ListResult
    expect(remaining.page).toHaveLength(1)
  })
  test('read returns single row by id', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, { parent: 'rd', payload: { optionIdx: 1, voter: 'r' } })
    const list = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'rd' })) as ListResult
    const id = list.page[0]?._id
    const got = (await callQuery(tt, api.votes.read, { id })) as VoteDoc
    expect(got.voter).toBe('r')
  })
  test('listAfter returns rows after a given seq', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, { parent: 'la', payload: { optionIdx: 0, voter: 'X' } })
    await callMutate(tt, api.votes.append, { parent: 'la', payload: { optionIdx: 1, voter: 'Y' } })
    await callMutate(tt, api.votes.append, { parent: 'la', payload: { optionIdx: 2, voter: 'Z' } })
    const after = (await callQuery(tt, api.votes.listAfter, { parent: 'la', seq: 1 })) as VoteDoc[]
    expect(after.length).toBeGreaterThanOrEqual(2)
  })
  test('purgeByParent with purge=1 hard-deletes despite softDelete', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, { parent: 'hd', payload: { optionIdx: 0, voter: 'A' } })
    await callMutate(tt, api.votes.purgeByParent, { parent: 'hd', purge: 1 })
    await callMutate(tt, api.votes.restoreByParent, { parent: 'hd' })
    const list3 = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'hd' })) as ListResult
    expect(list3.page).toHaveLength(0)
  })
  test('authIndexed queries via secondary index', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, { parent: 'ai-1', payload: { optionIdx: 0, voter: 'A' } })
    await callMutate(tt, api.votes.append, { parent: 'ai-1', payload: { optionIdx: 1, voter: 'B' } })
    await callMutate(tt, api.votes.append, { parent: 'ai-2', payload: { optionIdx: 0, voter: 'C' } })
    const r = (await callQuery(tt, api.votes.authIndexed, {
      index: 'by_parent',
      key: 'parent',
      value: 'ai-1'
    })) as VoteDoc[]
    expect(r.length).toBe(2)
  })
  test('append with idempotencyKey dedupes second insert', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, {
      idempotencyKey: 'k1',
      parent: 'idem',
      payload: { optionIdx: 0, voter: 'A' }
    })
    await callMutate(tt, api.votes.append, {
      idempotencyKey: 'k1',
      parent: 'idem',
      payload: { optionIdx: 9, voter: 'B' }
    })
    const listed = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'idem' })) as ListResult
    expect(listed.page).toHaveLength(1)
  })
  test('list scopes by parent', async () => {
    const tt = await seedUser(t())
    await callMutate(tt, api.votes.append, { parent: 'p-A', payload: { optionIdx: 0, voter: 'X' } })
    await callMutate(tt, api.votes.append, { parent: 'p-B', payload: { optionIdx: 1, voter: 'Y' } })
    const a = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'p-A' })) as ListResult
    const b = (await callQuery(tt, api.votes.list, { paginationOpts, parent: 'p-B' })) as ListResult
    expect(a.page).toHaveLength(1)
    expect(a.page[0]?.voter).toBe('X')
    expect(b.page).toHaveLength(1)
    expect(b.page[0]?.voter).toBe('Y')
  })
})
