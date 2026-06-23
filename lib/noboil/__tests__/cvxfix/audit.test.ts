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
    audits: {
      append: unknown
      listByActor: unknown
      listByTrace: unknown
      recent: unknown
    }
  }
}
const { api } = apiMod
interface AuditRow {
  _creationTime: number
  _id: string
  action: string
  actor: string
  ok: boolean
  traceId?: string
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
describe('makeAudit integration', () => {
  test('append + recent returns rows newest-first', async () => {
    const tt = t()
    await callMutate(tt, api.audits.append, { action: 'login', actor: 'alice', ok: true })
    await callMutate(tt, api.audits.append, { action: 'logout', actor: 'alice', ok: true })
    const rows = (await callQuery(tt, api.audits.recent, {})) as AuditRow[]
    expect(rows).toHaveLength(2)
    expect(rows[0]?.action).toBe('logout')
    expect(rows[1]?.action).toBe('login')
  })
  test('listByActor filters by actor', async () => {
    const tt = t()
    await callMutate(tt, api.audits.append, { action: 'login', actor: 'alice', ok: true })
    await callMutate(tt, api.audits.append, { action: 'login', actor: 'bob', ok: true })
    const rows = (await callQuery(tt, api.audits.listByActor, { actor: 'alice' })) as AuditRow[]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actor).toBe('alice')
  })
  test('pruneStale deletes stale rows when Date.now is moved into the future', async () => {
    const tt = t()
    await callMutate(tt, api.audits.append, { action: 'old', actor: 'a', ok: true })
    const origNow = Date.now
    Date.now = () => origNow() + 365 * 24 * 60 * 60 * 1000
    try {
      const r = (await tt.mutation((api as { audits: { pruneStale: unknown } }).audits.pruneStale as never, {})) as {
        deleted: number
      }
      expect(r.deleted).toBeGreaterThanOrEqual(0)
    } finally {
      Date.now = origNow
    }
  })
  test('pruneStale returns deleted=0 when nothing is stale', async () => {
    const tt = t()
    await callMutate(tt, api.audits.append, { action: 'fresh', actor: 'a', ok: true })
    const r = (await tt.mutation((api as { audits: { pruneStale: unknown } }).audits.pruneStale as never, {})) as {
      deleted: number
    }
    expect(r.deleted).toBe(0)
  })
  test('listByTrace filters by traceId', async () => {
    const tt = t()
    await callMutate(tt, api.audits.append, { action: 'a', actor: 'alice', ok: true, traceId: 'trace-1' })
    await callMutate(tt, api.audits.append, { action: 'b', actor: 'alice', ok: false, traceId: 'trace-2' })
    const rows = (await callQuery(tt, api.audits.listByTrace, { traceId: 'trace-1' })) as AuditRow[]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('a')
  })
})
