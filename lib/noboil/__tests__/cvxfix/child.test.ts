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
    messages: {
      create: unknown
      get: unknown
      list: unknown
      pubGet: unknown
      pubList: unknown
      rm: unknown
      update: unknown
    }
    todos: { create: unknown }
  }
}
const { api } = apiMod
interface MessageDoc {
  _id: string
  chatId: string
  text: string
  updatedAt: number
}
const seedUserAndChat = async (root: ReturnType<typeof t>): Promise<{ chatId: string; tt: ReturnType<typeof t> }> => {
  const userId = (await root.run(async ctx => ctx.db.insert('users', { name: 'seed' }))) as string
  const tt = root.withIdentity({ subject: userId }) as ReturnType<typeof t>
  const chatId = (await tt.run(async ctx =>
    ctx.db.insert('chat', { published: false, title: 't', updatedAt: Date.now(), userId })
  )) as string
  return { chatId, tt }
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
describe('makeChildCrud integration', () => {
  test('create child + list by parent', async () => {
    const { chatId, tt } = await seedUserAndChat(t())
    await callMutate(tt, api.messages.create, { chatId, text: 'hi' })
    await callMutate(tt, api.messages.create, { chatId, text: 'world' })
    const listed = (await callQuery(tt, api.messages.list, { chatId })) as MessageDoc[]
    expect(listed).toHaveLength(2)
  })
  test('get by id', async () => {
    const { chatId, tt } = await seedUserAndChat(t())
    const id = (await callMutate(tt, api.messages.create, { chatId, text: 'one' })) as string
    const fetched = (await callQuery(tt, api.messages.get, { id })) as MessageDoc
    expect(fetched.text).toBe('one')
    expect(fetched.chatId).toBe(chatId)
  })
  test('update + rm', async () => {
    const { chatId, tt } = await seedUserAndChat(t())
    const id = (await callMutate(tt, api.messages.create, { chatId, text: 'a' })) as string
    await callMutate(tt, api.messages.update, { id, text: 'updated' })
    const got = (await callQuery(tt, api.messages.get, { id })) as MessageDoc
    expect(got.text).toBe('updated')
    await callMutate(tt, api.messages.rm, { id })
    const after = (await callQuery(tt, api.messages.list, { chatId })) as MessageDoc[]
    expect(after).toHaveLength(0)
  })
  test('pub.list returns rows when parent.published=true', async () => {
    const root = t()
    const { tt } = await seedUserAndChat(root)
    const userId = (await tt.run(async ctx => (await ctx.db.query('users').collect())[0]?._id ?? '')) as string
    const publicChatId = (await tt.run(async ctx =>
      ctx.db.insert('chat', { published: true, title: 'public', updatedAt: Date.now(), userId })
    )) as string
    await callMutate(tt, api.messages.create, { chatId: publicChatId, text: 'hello world' })
    const list = (await callQuery(tt, api.messages.pubList, { chatId: publicChatId })) as MessageDoc[]
    expect(list).toHaveLength(1)
    expect(list[0]?.text).toBe('hello world')
  })
  test('pub.list rejects when parent.published=false', async () => {
    const { chatId, tt } = await seedUserAndChat(t())
    await callMutate(tt, api.messages.create, { chatId, text: 'private' })
    await expect(callQuery(tt, api.messages.pubList, { chatId })).rejects.toThrow()
  })
  test('create with items[] inserts bulk + update with items[] + rm with ids[]', async () => {
    const { chatId, tt } = await seedUserAndChat(t())
    const ids = (await callMutate(tt, api.messages.create, {
      chatId,
      items: [
        { chatId, text: 'a' },
        { chatId, text: 'b' },
        { chatId, text: 'c' }
      ]
    })) as string[]
    expect(ids).toHaveLength(3)
    const updates = (await callMutate(tt, api.messages.update, {
      items: [
        { id: ids[0], text: 'a-up' },
        { id: ids[1], text: 'b-up' }
      ]
    })) as { text: string }[]
    expect(updates).toHaveLength(2)
    const deleted = (await callMutate(tt, api.messages.rm, { ids: ids.slice(0, 2) })) as number
    expect(deleted).toBe(2)
    const after = (await callQuery(tt, api.messages.list, { chatId })) as MessageDoc[]
    expect(after).toHaveLength(1)
  })
  test('list scopes by chatId', async () => {
    const { chatId: c1, tt } = await seedUserAndChat(t())
    const userId = (await tt.run(async ctx => (await ctx.db.query('users').collect())[0]?._id ?? '')) as string
    const c2 = (await tt.run(async ctx =>
      ctx.db.insert('chat', { published: true, title: 'c2', updatedAt: Date.now(), userId })
    )) as string
    await callMutate(tt, api.messages.create, { chatId: c1, text: 'in-c1' })
    await callMutate(tt, api.messages.create, { chatId: c2, text: 'in-c2' })
    const a = (await callQuery(tt, api.messages.list, { chatId: c1 })) as MessageDoc[]
    const b = (await callQuery(tt, api.messages.list, { chatId: c2 })) as MessageDoc[]
    expect(a).toHaveLength(1)
    expect(a[0]?.text).toBe('in-c1')
    expect(b).toHaveLength(1)
    expect(b[0]?.text).toBe('in-c2')
  })
})
