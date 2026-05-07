import { describe, expect, test } from 'bun:test'
import { makeLog } from '../log'
import { captureReducers, tsAtMs } from './_helpers'
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
      find: (id: number) => rows.find(r => r.id === id) ?? null,
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
const senderIdent = {} as never
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
  test('purge_by_parent hard deletes when softDelete is false', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    const calls: string[] = []
    makeLog(
      { reducer },
      {
        fields: { voter: {} as never },
        idempotencyKeyField: {} as never,
        options: {
          hooks: {
            afterAppend: () => {
              calls.push('afterAppend')
            },
            afterPurge: () => {
              calls.push('afterPurge')
            },
            beforeAppend: (_c, p) => {
              calls.push('beforeAppend')
              return p.data
            },
            beforePurge: () => {
              calls.push('beforePurge')
            }
          }
        },
        parentField: {} as never,
        table: () => tbl as never,
        tableName: 'vote'
      }
    )
    const appendFn = reducers.append_vote as (c: never, a: never) => void
    const purgeFn = reducers.purge_vote_by_parent as (c: never, a: never) => void
    appendFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { parent: 'p1', voter: 'x' } as never)
    purgeFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(10) } as never, { parent: 'p1' } as never)
    expect(rows).toHaveLength(0)
    expect(calls).toEqual(['beforeAppend', 'afterAppend', 'beforePurge', 'afterPurge'])
  })
  test('bulk_append inserts all items in single call', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeLog(
      { reducer },
      {
        bulkItemsField: {} as never,
        fields: { voter: {} as never },
        idempotencyKeyField: {} as never,
        parentField: {} as never,
        table: () => tbl as never,
        tableName: 'vote'
      }
    )
    const bulk = reducers.bulk_append_vote as (c: never, a: never) => void
    bulk(
      { db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never,
      { items: [{ voter: 'a' }, { idempotencyKey: 'k', voter: 'b' }], parent: 'p' } as never
    )
    expect(rows).toHaveLength(2)
    expect(rows[1]?.idempotencyKey).toBe('k')
  })
  test('update mutates row payload by id', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeLog(
      { reducer },
      {
        fields: { voter: { optional: () => ({}) } as never },
        idField: {} as never,
        idempotencyKeyField: {} as never,
        parentField: {} as never,
        table: () => tbl as never,
        tableName: 'vote'
      }
    )
    const appendFn = reducers.append_vote as (c: never, a: never) => void
    const updateFn = reducers.update_vote as (c: never, a: never) => void
    appendFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { parent: 'p', voter: 'a' } as never)
    updateFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(1) } as never, { id: 1, voter: 'b' } as never)
    expect(rows[0]?.voter).toBe('b')
  })
  test('rm hard-deletes by id; bulk_rm deletes many', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeLog(
      { reducer },
      {
        fields: { voter: {} as never },
        idField: {} as never,
        idempotencyKeyField: {} as never,
        idsField: {} as never,
        parentField: {} as never,
        table: () => tbl as never,
        tableName: 'vote'
      }
    )
    const appendFn = reducers.append_vote as (c: never, a: never) => void
    const rmFn = reducers.rm_vote as (c: never, a: never) => void
    const bulkRmFn = reducers.bulk_rm_vote as (c: never, a: never) => void
    appendFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { parent: 'p', voter: 'a' } as never)
    appendFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { parent: 'p', voter: 'b' } as never)
    appendFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { parent: 'p', voter: 'c' } as never)
    rmFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(1) } as never, { id: 1 } as never)
    expect(rows).toHaveLength(2)
    bulkRmFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(2) } as never, { ids: [2, 3, 999] } as never)
    expect(rows).toHaveLength(0)
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
