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
  api: { profiles: { get: unknown; upsert: unknown } }
}
const { api } = apiMod
interface ProfileDoc {
  _id: string
  bio: string
  deletedAt?: number
  name: string
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
describe('makeSingletonCrud integration', () => {
  test('upsert creates row on first call, then updates', async () => {
    const { tt } = await seedUser(t())
    await callMutate(tt, api.profiles.upsert, { bio: 'first', name: 'Alice' })
    const doc1 = (await callQuery(tt, api.profiles.get, {})) as ProfileDoc
    expect(doc1.name).toBe('Alice')
    expect(doc1.bio).toBe('first')
    await callMutate(tt, api.profiles.upsert, { bio: 'second', name: 'Alice' })
    const doc2 = (await callQuery(tt, api.profiles.get, {})) as ProfileDoc
    expect(doc2._id).toBe(doc1._id)
    expect(doc2.bio).toBe('second')
  })
  test('different users get different rows', async () => {
    const root = t()
    const { tt: tt1 } = await seedUser(root)
    const { tt: tt2 } = await seedUser(root)
    await callMutate(tt1, api.profiles.upsert, { bio: 'b-bio', name: 'B' })
    await callMutate(tt2, api.profiles.upsert, { bio: 'c-bio', name: 'C' })
    expect(((await callQuery(tt1, api.profiles.get, {})) as ProfileDoc).name).toBe('B')
    expect(((await callQuery(tt2, api.profiles.get, {})) as ProfileDoc).name).toBe('C')
  })
  test('get on user with no row returns null', async () => {
    const { tt } = await seedUser(t())
    const r = await callQuery(tt, api.profiles.get, {})
    expect(r).toBeNull()
  })
})
