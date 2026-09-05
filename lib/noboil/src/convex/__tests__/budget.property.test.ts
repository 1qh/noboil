/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { describe, expect, test } from 'bun:test'
import type { Lcg } from '../../shared/test/index'
import type { BudgetDB } from './_budget-fakes'
import { advanceNow, createLcg, restoreNow, setNow } from '../../shared/test/index'
import { makeBudget, periodKeyFor } from '../server/budget'
import { createBudgetDb as createDb, makeBudgetDb as mkDb } from './_budget-fakes'

const DAY_MS = 24 * 60 * 60 * 1000
const CAP = 1000
const INFLIGHT_MAX = 8
const captureBuilder = () => {
  const handlers: Record<string, (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>> = {}
  const m = ({ handler }: { args: unknown; handler: (...a: unknown[]) => unknown }) => {
    const fn = handler as (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>
    return fn
  }
  const q = m
  return { handlers, m, q }
}
const setupBudget = () => {
  const db = createDb()
  const { m, q } = captureBuilder()
  const builders = { m, q } as unknown as Parameters<typeof makeBudget>[0]['builders']
  const exports = makeBudget({ builders, cap: CAP, inflightMax: INFLIGHT_MAX, table: 'budget' })
  const ctx = { db: mkDb(db), storage: {}, user: { _id: 'u1' } } as unknown as Record<string, unknown>
  return { ctx, db, exports }
}
const sumInflight = (db: BudgetDB, owner: string): number => {
  let s = 0
  for (const r of db.rows) if (r.owner === owner) s += r.inflight
  return s
}
const todayBalance = (db: BudgetDB, owner: string): number => {
  const key = periodKeyFor(Date.now(), DAY_MS)
  const row = db.rows.find(r => r.owner === owner && r.periodKey === key)
  return row?.balance ?? 0
}
interface Op {
  amount: number
  kind: 'reserve' | 'settle'
}
const planOps = (rng: Lcg, n: number): Op[] => {
  const ops: Op[] = []
  for (let i = 0; i < n; i += 1)
    ops.push({
      amount: rng.int(200) + 1,
      kind: rng.next() < 0.55 ? 'reserve' : 'settle'
    })
  return ops
}
interface Reservation {
  amount: number
  periodKey: string
}
type ReserveFn = (
  c: unknown,
  a: Record<string, unknown>
) => Promise<{ balance: number; ok: boolean; periodKey: string; reason?: string }>
type SettleFn = (c: unknown, a: Record<string, unknown>) => Promise<void>
const applyReserve = async (opts: {
  amount: number
  ctx: unknown
  exports: Record<string, unknown>
  owner: string
  reservations: Reservation[]
}): Promise<void> => {
  const { amount, ctx, exports, owner, reservations } = opts
  const r = await (exports.reserve as ReserveFn)(ctx, { amount, owner })
  if (r.ok) reservations.push({ amount, periodKey: r.periodKey })
  // biome-ignore lint/suspicious/noMisplacedAssertion: shared property-test assertion helper invoked from within test()
  expect(r.balance).toBeGreaterThanOrEqual(0)
  // biome-ignore lint/suspicious/noMisplacedAssertion: shared property-test assertion helper invoked from within test()
  if (r.ok) expect(r.balance).toBeLessThanOrEqual(CAP)
}
const applySettle = async (opts: {
  ctx: unknown
  exports: Record<string, unknown>
  owner: string
  reservations: Reservation[]
  rng: Lcg
}): Promise<void> => {
  const { ctx, exports, owner, reservations, rng } = opts
  if (reservations.length === 0) return
  const idx = rng.int(reservations.length)
  const reservation = reservations[idx]
  if (!reservation) return
  reservations.splice(idx, 1)
  const actual = Math.max(0, Math.floor(reservation.amount * (rng.next() * 1.5)))
  await (exports.settle as SettleFn)(ctx, {
    actualAmount: actual,
    owner,
    reservedAmount: reservation.amount,
    reservedPeriodKey: reservation.periodKey
  })
}
const assertRowInvariants = (db: BudgetDB, owner: string): void => {
  for (const r of db.rows.filter(rr => rr.owner === owner)) {
    // biome-ignore lint/suspicious/noMisplacedAssertion: shared property-test assertion helper invoked from within test()
    expect(r.balance).toBeGreaterThanOrEqual(0)
    // biome-ignore lint/suspicious/noMisplacedAssertion: shared property-test assertion helper invoked from within test()
    expect(r.inflight).toBeGreaterThanOrEqual(0)
  }
  // biome-ignore lint/suspicious/noMisplacedAssertion: shared property-test assertion helper invoked from within test()
  expect(sumInflight(db, owner)).toBeLessThanOrEqual(INFLIGHT_MAX)
}
const runReserveSettleSeed = async (seed: number): Promise<void> => {
  setNow(Date.parse('2026-04-29T12:00:00Z'))
  const { ctx, db, exports } = setupBudget()
  const owner = `seed${seed}`
  const rng = createLcg(seed)
  const ops = planOps(rng, 200)
  const reservations: Reservation[] = []
  for (const op of ops) {
    await (op.kind === 'reserve'
      ? applyReserve({ amount: op.amount, ctx, exports, owner, reservations })
      : applySettle({ ctx, exports, owner, reservations, rng }))
    assertRowInvariants(db, owner)
  }
  restoreNow()
}
describe('budget property invariants', () => {
  test('reserve+settle never exceeds tolerance, never produces negative inflight/balance', async () => {
    const seeds = [1, 7, 42, 99, 12_345]
    for (const seed of seeds) await runReserveSettleSeed(seed)
  })
  test('cap rejection prevents overshoot', async () => {
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const db = createDb()
    const { m, q } = captureBuilder()
    const builders = { m, q } as unknown as Parameters<typeof makeBudget>[0]['builders']
    const exports = makeBudget({ builders, cap: CAP, inflightMax: 1000, table: 'budget' })
    const ctx = { db: mkDb(db), storage: {}, user: { _id: 'u1' } } as unknown as Record<string, unknown>
    const owner = 'cap-test'
    let rejections = 0
    for (let i = 0; i < 50; i += 1) {
      const r = await (
        exports.reserve as unknown as (
          c: unknown,
          a: Record<string, unknown>
        ) => Promise<{ balance: number; ok: boolean; reason?: string }>
      )(ctx, { amount: 100, owner })
      if (!r.ok && r.reason === 'cap') rejections += 1
    }
    expect(todayBalance(db, owner)).toBeLessThanOrEqual(CAP)
    expect(rejections).toBeGreaterThan(0)
    restoreNow()
  })
  test('cross-period settlement books overage on current period', async () => {
    const { ctx, db, exports } = setupBudget()
    setNow(Date.parse('2026-04-28T12:00:00Z'))
    const owner = 'cross-period'
    const r = await (
      exports.reserve as unknown as (
        c: unknown,
        a: Record<string, unknown>
      ) => Promise<{ balance: number; ok: boolean; periodKey: string }>
    )(ctx, { amount: 100, owner })
    expect(r.ok).toBe(true)
    advanceNow(DAY_MS + 60_000)
    await (exports.settle as unknown as (c: unknown, a: Record<string, unknown>) => Promise<void>)(ctx, {
      actualAmount: 250,
      owner,
      reservedAmount: 100,
      reservedPeriodKey: r.periodKey
    })
    const today = periodKeyFor(Date.now(), DAY_MS)
    const yest = r.periodKey
    const yestRow = db.rows.find(rr => rr.owner === owner && rr.periodKey === yest)
    const todayRow = db.rows.find(rr => rr.owner === owner && rr.periodKey === today)
    expect(yestRow?.inflight ?? -1).toBe(0)
    expect(todayRow?.balance ?? 0).toBe(150)
    restoreNow()
  })
  test('inflight cap rejects reserve when at limit', async () => {
    const { ctx, exports } = setupBudget()
    setNow(Date.parse('2026-04-29T12:00:00Z'))
    const owner = 'inflight-test'
    let inflightRejections = 0
    for (let i = 0; i < INFLIGHT_MAX + 5; i += 1) {
      const r = await (
        exports.reserve as unknown as (
          c: unknown,
          a: Record<string, unknown>
        ) => Promise<{ balance: number; ok: boolean; reason?: string }>
      )(ctx, { amount: 1, owner })
      if (!r.ok && r.reason === 'inflight') inflightRejections += 1
    }
    expect(inflightRejections).toBeGreaterThanOrEqual(5)
    restoreNow()
  })
})
