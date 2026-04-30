import { describe, expect, test } from 'bun:test'
import { makeLog } from '../log'
interface LogRow {
  createdAt: { microsSinceUnixEpoch: bigint }
  deletedAt?: null | { microsSinceUnixEpoch: bigint }
  id: number
  idempotencyKey?: null | string
  optionIdx?: number
  parent: string
  seq: number
  voter?: string
}
const mkTable = () => {
  const rows: LogRow[] = []
  let nextId = 1
  const tbl = {
    [Symbol.iterator]: () => rows[Symbol.iterator](),
    id: {
      delete: (id: number) => {
        const idx = rows.findIndex(r => r.id === id)
        if (idx !== -1) rows.splice(idx, 1)
      },
      update: (row: LogRow) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx !== -1) rows[idx] = row
        return row
      }
    },
    insert: (row: LogRow) => {
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
const captureReducers = () => {
  const out: Record<string, unknown> = {}
  const reducer = (opts: { name: string }, _params: unknown, fn: unknown) => {
    out[opts.name] = fn
    return fn
  }
  return { reducer, reducers: out }
}
describe('stdb makeLog', () => {
  test('append inserts a new row with monotonic seq', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeLog(
      { reducer },
      {
        fields: { optionIdx: {} as never, voter: {} as never },
        idempotencyKeyField: {} as never,
        parentField: {} as never,
        table: () => tbl as never,
        tableName: 'vote'
      }
    )
    const appendFn = reducers.append_vote as (c: never, a: never) => void
    appendFn(
      { db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never,
      { optionIdx: 0, parent: 'p', voter: 'a' } as never
    )
    appendFn(
      { db: {}, sender: senderIdent, timestamp: tsAtMs(10) } as never,
      { optionIdx: 1, parent: 'p', voter: 'b' } as never
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.seq).toBe(1)
    expect(rows[1]?.seq).toBe(2)
  })
  test('append with same idempotencyKey is idempotent', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeLog(
      { reducer },
      {
        fields: { voter: {} as never },
        idempotencyKeyField: {} as never,
        parentField: {} as never,
        table: () => tbl as never,
        tableName: 'vote'
      }
    )
    const appendFn = reducers.append_vote as (c: never, a: never) => void
    appendFn(
      { db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never,
      { idempotencyKey: 'key1', parent: 'p', voter: 'a' } as never
    )
    appendFn(
      { db: {}, sender: senderIdent, timestamp: tsAtMs(10) } as never,
      { idempotencyKey: 'key1', parent: 'p', voter: 'a' } as never
    )
    expect(rows).toHaveLength(1)
  })
  test('purge_by_parent with softDelete=true marks deletedAt; restore_by_parent clears it', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeLog(
      { reducer },
      {
        fields: { voter: {} as never },
        idempotencyKeyField: {} as never,
        options: { softDelete: true },
        parentField: {} as never,
        table: () => tbl as never,
        tableName: 'vote'
      }
    )
    const appendFn = reducers.append_vote as (c: never, a: never) => void
    const purgeFn = reducers.purge_vote_by_parent as (c: never, a: never) => void
    const restoreFn = reducers.restore_vote_by_parent as (c: never, a: never) => void
    appendFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { parent: 'p1', voter: 'a' } as never)
    purgeFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(10) } as never, { parent: 'p1' } as never)
    expect(rows[0]?.deletedAt).toBeTruthy()
    restoreFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(20) } as never, { parent: 'p1' } as never)
    expect(rows[0]?.deletedAt).toBeNull()
  })
})
