import { Glob } from 'bun'
import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import { resolve } from 'node:path'
import schema from './convex/schema'

interface QuotaResult {
  allowed: boolean
  remaining: number
  retryAfter?: number
}
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
  api: { quotas: { check: unknown; consume: unknown; record: unknown } }
}
const { api } = apiMod
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: { owner: string }): Promise<QuotaResult> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: { owner: string }): Promise<QuotaResult> =>
  tt.query(fn as never, args)
describe('makeQuota integration', () => {
  test('record then check returns remaining', async () => {
    const tt = t()
    const r1 = await callMutate(tt, api.quotas.record, { owner: 'k1' })
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBeLessThanOrEqual(2)
    const c = await callQuery(tt, api.quotas.check, { owner: 'k1' })
    expect(c.remaining).toBe(r1.remaining)
  })
  test('consume blocks past limit and returns retryAfter', async () => {
    const tt = t()
    for (let i = 0; i < 3; i += 1) {
      const r = await callMutate(tt, api.quotas.consume, { owner: 'k2' })
      expect(r.allowed).toBe(true)
    }
    const blocked = await callMutate(tt, api.quotas.consume, { owner: 'k2' })
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })
  test('check on empty owner returns full limit', async () => {
    const tt = t()
    const r = await callQuery(tt, api.quotas.check, { owner: 'fresh-owner' })
    expect(r.remaining).toBe(3)
  })
})
