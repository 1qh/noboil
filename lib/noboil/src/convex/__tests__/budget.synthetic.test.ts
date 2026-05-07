/* oxlint-disable no-await-in-loop, no-unused-vars */
/** biome-ignore-all lint/performance/noAwaitInLoops: sequential synthetic ops */
/** biome-ignore-all lint/correctness/noUnusedFunctionParameters: mock signatures */
import { describe, expect, test } from 'bun:test'
import { advanceNow, restoreNow, setNow } from '../../shared/test/index'
import { makeBudget, periodKeyFor } from '../server/budget'
import { createBudgetDb as createDb, makeBudgetDb as mkDb } from './_budget-fakes'
const DAY_MS = 24 * 60 * 60 * 1000
const CAP = 1000
const INFLIGHT_MAX = 8
const captureBuilder = () => {
  interface Spec {
    args: unknown
    handler: (...a: unknown[]) => unknown
  }
  const m = ({ handler }: Spec) => handler as (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>
  const q = m
  return { m, q }
}
const setupBudget = (overrides: Partial<Parameters<typeof makeBudget>[0]> = {}) => {
  const db = createDb()
  const { m, q } = captureBuilder()
  const builders = { m, q } as unknown as Parameters<typeof makeBudget>[0]['builders']
  const exports = makeBudget({ builders, cap: CAP, inflightMax: INFLIGHT_MAX, table: 'budget', ...overrides })
  const ctx = { db: mkDb(db), storage: {}, user: { _id: 'u1' } } as unknown as Record<string, unknown>
  return { ctx, db, exports }
}
type AddFn = (c: unknown, a: Record<string, unknown>) => Promise<void>
type AuditFn = (
  c: unknown,
  a: Record<string, unknown>
) => Promise<{ overshootBalance: number; overshootInflight: number; rows: number; stuckInflight: number }>
type CheckFn = (c: unknown, a: Record<string, unknown>) => Promise<{ balance: number; ok: boolean }>
type PruneFn = (c: unknown, a: Record<string, unknown>) => Promise<void>
type ReserveFn = (
  c: unknown,
  a: Record<string, unknown>
) => Promise<{ balance: number; ok: boolean; periodKey: string; reason?: string }>
type SettleFn = (c: unknown, a: Record<string, unknown>) => Promise<void>
const reserveOf = (e: ReturnType<typeof setupBudget>['exports']) => e.reserve as unknown as ReserveFn
const settleOf = (e: ReturnType<typeof setupBudget>['exports']) => e.settle as unknown as SettleFn
const checkOf = (e: ReturnType<typeof setupBudget>['exports']) => e.check as unknown as CheckFn
const addOf = (e: ReturnType<typeof setupBudget>['exports']) => e.add as unknown as AddFn
const auditOf = (e: ReturnType<typeof setupBudget>['exports']) => e.auditInvariants as unknown as AuditFn
const pruneOf = (e: ReturnType<typeof setupBudget>['exports']) => e.pruneStale as unknown as PruneFn
describe('budget synthetic scenarios', () => {
  test('inflight cap blocks 9th concurrent reserve', async () => {
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const { ctx, exports } = setupBudget()
    const reserve = reserveOf(exports)
    for (let i = 0; i < INFLIGHT_MAX; i += 1) {
      const r = await reserve(ctx, { amount: 10, owner: 'a' })
      expect(r.ok).toBe(true)
    }
    const blocked = await reserve(ctx, { amount: 10, owner: 'a' })
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toBe('inflight')
    restoreNow()
  })
  test('daily cap blocks reserves once exceeded', async () => {
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const { ctx, exports } = setupBudget({ inflightMax: 100 })
    const reserve = reserveOf(exports)
    let totalAccepted = 0
    for (let i = 0; i < 20; i += 1) {
      const r = await reserve(ctx, { amount: 100, owner: 'a' })
      if (r.ok) totalAccepted += 100
    }
    expect(totalAccepted).toBe(CAP)
    restoreNow()
  })
  test('reserve+settle exact match returns to zero balance growth', async () => {
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const { ctx, db, exports } = setupBudget()
    const r = await reserveOf(exports)(ctx, { amount: 100, owner: 'a' })
    if (!r.ok) throw new Error('reserve failed')
    await settleOf(exports)(ctx, { actualAmount: 100, owner: 'a', reservedAmount: 100, reservedPeriodKey: r.periodKey })
    const row = db.rows.find(rr => rr.owner === 'a')
    expect(row?.balance).toBe(100)
    expect(row?.inflight).toBe(0)
    restoreNow()
  })
  test('reserve+refund (actual=0) returns balance to zero', async () => {
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const { ctx, db, exports } = setupBudget()
    const r = await reserveOf(exports)(ctx, { amount: 200, owner: 'a' })
    if (!r.ok) throw new Error('reserve failed')
    await settleOf(exports)(ctx, { actualAmount: 0, owner: 'a', reservedAmount: 200, reservedPeriodKey: r.periodKey })
    const row = db.rows.find(rr => rr.owner === 'a')
    expect(row?.balance).toBe(0)
    expect(row?.inflight).toBe(0)
    restoreNow()
  })
  test('cross-midnight overage routes to today, refunds old day', async () => {
    setNow(Date.parse('2026-04-28T12:00:00Z'))
    const { ctx, db, exports } = setupBudget()
    const r = await reserveOf(exports)(ctx, { amount: 100, owner: 'a' })
    if (!r.ok) throw new Error('reserve failed')
    advanceNow(DAY_MS + 60_000)
    await settleOf(exports)(ctx, { actualAmount: 250, owner: 'a', reservedAmount: 100, reservedPeriodKey: r.periodKey })
    const today = periodKeyFor(Date.now(), DAY_MS)
    const todayRow = db.rows.find(rr => rr.owner === 'a' && rr.periodKey === today)
    const oldRow = db.rows.find(rr => rr.owner === 'a' && rr.periodKey === r.periodKey)
    expect(todayRow?.balance).toBe(150)
    expect(oldRow?.inflight).toBe(0)
    restoreNow()
  })
  test('cross-midnight under-spend keeps old day at actual', async () => {
    setNow(Date.parse('2026-04-28T12:00:00Z'))
    const { ctx, db, exports } = setupBudget()
    const r = await reserveOf(exports)(ctx, { amount: 200, owner: 'a' })
    if (!r.ok) throw new Error('reserve failed')
    advanceNow(DAY_MS + 60_000)
    await settleOf(exports)(ctx, { actualAmount: 75, owner: 'a', reservedAmount: 200, reservedPeriodKey: r.periodKey })
    const oldRow = db.rows.find(rr => rr.owner === 'a' && rr.periodKey === r.periodKey)
    expect(oldRow?.balance).toBe(75)
    restoreNow()
  })
  test('cross-midnight zero actual zeroes old-day spend', async () => {
    setNow(Date.parse('2026-04-28T12:00:00Z'))
    const { ctx, db, exports } = setupBudget()
    const r = await reserveOf(exports)(ctx, { amount: 200, owner: 'a' })
    if (!r.ok) throw new Error('reserve failed')
    advanceNow(DAY_MS + 60_000)
    await settleOf(exports)(ctx, { actualAmount: 0, owner: 'a', reservedAmount: 200, reservedPeriodKey: r.periodKey })
    const oldRow = db.rows.find(rr => rr.owner === 'a' && rr.periodKey === r.periodKey)
    expect(oldRow?.balance).toBe(0)
    restoreNow()
  })
  test('add with negative delta clamps at zero', async () => {
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const { ctx, db, exports } = setupBudget()
    await addOf(exports)(ctx, { amount: 50, owner: 'a' })
    await addOf(exports)(ctx, { amount: -200, owner: 'a' })
    const row = db.rows.find(rr => rr.owner === 'a')
    expect(row?.balance).toBe(0)
    restoreNow()
  })
  test('check returns balance + ok flag', async () => {
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const { ctx, exports } = setupBudget()
    let r = await checkOf(exports)(ctx, { owner: 'a' })
    expect(r.balance).toBe(0)
    expect(r.ok).toBe(true)
    await reserveOf(exports)(ctx, { amount: 600, owner: 'a' })
    r = await checkOf(exports)(ctx, { owner: 'a' })
    expect(r.balance).toBe(600)
    expect(r.ok).toBe(true)
    await reserveOf(exports)(ctx, { amount: 400, owner: 'a' })
    r = await checkOf(exports)(ctx, { owner: 'a' })
    expect(r.ok).toBe(false)
    restoreNow()
  })
  test('inflight scoped per owner', async () => {
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const { ctx, exports } = setupBudget()
    const reserve = reserveOf(exports)
    for (let i = 0; i < INFLIGHT_MAX; i += 1) await reserve(ctx, { amount: 1, owner: 'a' })
    for (let i = 0; i < INFLIGHT_MAX; i += 1) {
      const r = await reserve(ctx, { amount: 1, owner: 'b' })
      expect(r.ok).toBe(true)
    }
    restoreNow()
  })
  test('auditInvariants no-ops on empty', async () => {
    const { ctx, exports } = setupBudget()
    const r = await auditOf(exports)(ctx, {})
    expect(r.rows).toBe(0)
    expect(r.overshootBalance).toBe(0)
    expect(r.overshootInflight).toBe(0)
    expect(r.stuckInflight).toBe(0)
  })
  test('pruneStale removes old zero-inflight rows, keeps inflight>0', async () => {
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const { ctx, db, exports } = setupBudget()
    db.rows.push(
      { _id: 'old1', balance: 100, inflight: 0, owner: 'a', periodKey: '2026-04-25' },
      { _id: 'old2', balance: 50, inflight: 1, owner: 'b', periodKey: '2026-04-25' },
      { _id: 'today', balance: 10, inflight: 0, owner: 'c', periodKey: '2026-04-29' }
    )
    db._next = 100
    await pruneOf(exports)(ctx, {})
    const ids = new Set(db.rows.map(r => r._id))
    expect(ids.has('old1')).toBe(false)
    expect(ids.has('old2')).toBe(true)
    expect(ids.has('today')).toBe(true)
    restoreNow()
  })
})
