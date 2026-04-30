/* oxlint-disable typescript-eslint(no-unsafe-call), typescript-eslint(no-unsafe-member-access) */
import { describe, expect, test } from 'bun:test'
import { makeQuota } from '../quota'
interface QuotaRow {
  id: number
  owner: string
  timestamps: number[]
}
const mkTable = () => {
  const rows: QuotaRow[] = []
  let nextId = 1
  const tbl = {
    [Symbol.iterator]: () => rows[Symbol.iterator](),
    id: {
      update: (row: QuotaRow) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx !== -1) rows[idx] = row
        return row
      }
    },
    insert: (row: QuotaRow): QuotaRow => {
      const next = { ...row, id: nextId }
      nextId += 1
      rows.push(next)
      return next
    }
  }
  return { rows, tbl }
}
const tsAtMs = (ms: number) => ({ microsSinceUnixEpoch: BigInt(ms) * 1000n }) as never
const senderIdent = {} as never
describe('stdb makeQuota', () => {
  test('record reducer inserts new row when owner unseen', () => {
    const captured: Record<string, unknown> = {}
    const reducer = (opts: { name: string }, _params: unknown, fn: unknown) => {
      captured[opts.name] = fn
    }
    const { rows, tbl } = mkTable()
    const ownerField = {} as never
    makeQuota(
      { reducer },
      {
        durationMs: 60_000,
        limit: 3,
        ownerField,
        table: () => tbl as never,
        tableName: 'quota'
      }
    )
    const recordFn = captured.record_quota as
      | ((ctx: { db: unknown; sender: unknown; timestamp: unknown }, args: { owner: string }) => void)
      | undefined
    expect(typeof recordFn).toBe('function')
    recordFn?.({ db: {}, sender: senderIdent, timestamp: tsAtMs(1000) }, { owner: 'a' })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.owner).toBe('a')
    expect(rows[0]?.timestamps).toEqual([1000])
  })
  test('consume reducer rejects past limit', () => {
    const captured: Record<string, unknown> = {}
    const reducer = (opts: { name: string }, _params: unknown, fn: unknown) => {
      captured[opts.name] = fn
    }
    const { rows, tbl } = mkTable()
    let lastResult: null | { allowed: boolean } = null
    makeQuota(
      { reducer },
      {
        durationMs: 60_000,
        hooks: {
          afterConsume: (_c, args) => {
            lastResult = { allowed: args.allowed }
          }
        },
        limit: 2,
        ownerField: {} as never,
        table: () => tbl as never,
        tableName: 'quota'
      }
    )
    const consumeFn = captured.consume_quota as (
      ctx: { db: unknown; sender: unknown; timestamp: unknown },
      args: { owner: string }
    ) => void
    consumeFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) }, { owner: 'b' })
    consumeFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(100) }, { owner: 'b' })
    expect(() => {
      consumeFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(200) }, { owner: 'b' })
    }).toThrow('LIMIT_EXCEEDED')
    expect(lastResult as unknown).toEqual({ allowed: false })
    expect(rows[0]?.timestamps).toHaveLength(2)
  })
})
