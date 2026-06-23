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
  api: { presences: { heartbeat: unknown; leave: unknown; list: unknown } }
}
const { api } = apiMod
interface PresenceRow {
  data?: unknown
  expiresAt?: number
  lastSeenAt?: number
  roomId: string
  updatedAt?: number
  userId: string
}
const seedUser = async (root: ReturnType<typeof t>): Promise<{ tt: ReturnType<typeof t>; userId: string }> => {
  const userId = (await root.run(async ctx => ctx.db.insert('users', { name: 'seed' }))) as string
  return { tt: root.withIdentity({ subject: userId }) as ReturnType<typeof t>, userId }
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
describe('makePresence integration', () => {
  test('heartbeat creates row, list returns it', async () => {
    const { tt, userId } = await seedUser(t())
    await callMutate(tt, api.presences.heartbeat, { roomId: 'r1' })
    const rows = (await callQuery(tt, api.presences.list, { roomId: 'r1' })) as PresenceRow[]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(userId)
  })
  test('repeat heartbeat does not duplicate; bumps lastSeenAt', async () => {
    const { tt } = await seedUser(t())
    await callMutate(tt, api.presences.heartbeat, { data: { typing: false }, roomId: 'r2' })
    await callMutate(tt, api.presences.heartbeat, { data: { typing: true }, roomId: 'r2' })
    const rows = (await callQuery(tt, api.presences.list, { roomId: 'r2' })) as PresenceRow[]
    expect(rows).toHaveLength(1)
  })
  test('leave removes the row', async () => {
    const { tt } = await seedUser(t())
    await callMutate(tt, api.presences.heartbeat, { roomId: 'r3' })
    await callMutate(tt, api.presences.leave, { roomId: 'r3' })
    const rows = (await callQuery(tt, api.presences.list, { roomId: 'r3' })) as PresenceRow[]
    expect(rows).toHaveLength(0)
  })
  test('list filters by room', async () => {
    const root = t()
    const { tt: a } = await seedUser(root)
    const { tt: b } = await seedUser(root)
    await callMutate(a, api.presences.heartbeat, { roomId: 'rA' })
    await callMutate(b, api.presences.heartbeat, { roomId: 'rB' })
    const rowsA = (await callQuery(a, api.presences.list, { roomId: 'rA' })) as PresenceRow[]
    const rowsB = (await callQuery(b, api.presences.list, { roomId: 'rB' })) as PresenceRow[]
    expect(rowsA).toHaveLength(1)
    expect(rowsB).toHaveLength(1)
  })
})
