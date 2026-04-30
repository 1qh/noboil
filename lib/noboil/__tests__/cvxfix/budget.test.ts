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
  api: { budgets: { add: unknown; check: unknown; reserve: unknown; settle: unknown } }
}
const { api } = apiMod
interface CheckResult {
  balance: number
  ok: boolean
}
interface ReserveResult {
  balance: number
  ok: boolean
  periodKey: string
  reason?: string
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
describe('makeBudget integration (via wired builders)', () => {
  test('check on empty owner returns zero balance + ok', async () => {
    const tt = t()
    const r = (await callQuery(tt, api.budgets.check, { owner: 'fresh' })) as CheckResult
    expect(r.balance).toBe(0)
    expect(r.ok).toBe(true)
  })
  test('reserve succeeds and updates balance', async () => {
    const tt = t()
    const r = (await callMutate(tt, api.budgets.reserve, { amount: 200, owner: 'u1' })) as ReserveResult
    expect(r.ok).toBe(true)
    expect(r.balance).toBeGreaterThanOrEqual(200)
  })
  test('add tops up balance via direct row write', async () => {
    const tt = t()
    await callMutate(tt, api.budgets.add, { amount: 500, owner: 'u2' })
    const r = (await callQuery(tt, api.budgets.check, { owner: 'u2' })) as CheckResult
    expect(r.balance).toBeGreaterThanOrEqual(500)
  })
  test('settle adjusts balance per actual usage', async () => {
    const tt = t()
    const reserved = (await callMutate(tt, api.budgets.reserve, { amount: 100, owner: 'u3' })) as ReserveResult
    expect(reserved.ok).toBe(true)
    await callMutate(tt, api.budgets.settle, {
      actualAmount: 80,
      owner: 'u3',
      reservedAmount: 100,
      reservedPeriodKey: reserved.periodKey
    })
    const c = (await callQuery(tt, api.budgets.check, { owner: 'u3' })) as CheckResult
    expect(c.balance).toBe(80)
  })
})
