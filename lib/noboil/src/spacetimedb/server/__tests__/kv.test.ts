import { describe, expect, test } from 'bun:test'
import { makeKv } from '../kv'
interface KvRow {
  active?: boolean
  deletedAt?: null | { microsSinceUnixEpoch: bigint }
  id: number
  key: string
  message?: string
  updatedAt: { microsSinceUnixEpoch: bigint }
}
const mkTable = () => {
  const rows: KvRow[] = []
  let nextId = 1
  const tbl = {
    [Symbol.iterator]: () => rows[Symbol.iterator](),
    id: {
      delete: (id: number) => {
        const idx = rows.findIndex(r => r.id === id)
        if (idx !== -1) rows.splice(idx, 1)
      },
      update: (row: KvRow) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx !== -1) rows[idx] = row
        return row
      }
    },
    insert: (row: KvRow) => {
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
describe('stdb makeKv', () => {
  test('set inserts a new row', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeKv(
      { reducer },
      {
        fields: {},
        keyField: {} as never,
        table: () => tbl as never,
        tableName: 'config'
      }
    )
    const setFn = reducers.set_config as (
      ctx: { db: unknown; sender: unknown; timestamp: unknown },
      args: { key: string; message?: string }
    ) => void
    setFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(100) }, { key: 'banner', message: 'hello' })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.key).toBe('banner')
  })
  test('set with stale expectedUpdatedAt throws CONFLICT', () => {
    const { reducer, reducers } = captureReducers()
    const { tbl } = mkTable()
    makeKv(
      { reducer },
      {
        expectedUpdatedAtField: {} as never,
        fields: {},
        keyField: {} as never,
        table: () => tbl as never,
        tableName: 'config'
      }
    )
    const setFn = reducers.set_config as (
      ctx: { db: unknown; sender: unknown; timestamp: unknown },
      args: { expectedUpdatedAt?: { microsSinceUnixEpoch: bigint }; key: string; message?: string }
    ) => void
    setFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(100) }, { key: 'k', message: 'v1' })
    expect(() => {
      setFn(
        { db: {}, sender: senderIdent, timestamp: tsAtMs(200) },
        { expectedUpdatedAt: tsAtMs(999), key: 'k', message: 'v2' }
      )
    }).toThrow('CONFLICT')
  })
  test('writeRole returning false throws FORBIDDEN', () => {
    const { reducer, reducers } = captureReducers()
    const { tbl } = mkTable()
    makeKv(
      { reducer },
      {
        fields: {},
        keyField: {} as never,
        table: () => tbl as never,
        tableName: 'config',
        writeRole: () => false
      }
    )
    const setFn = reducers.set_config as (
      ctx: { db: unknown; sender: unknown; timestamp: unknown },
      args: { key: string }
    ) => void
    expect(() => {
      setFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) }, { key: 'k' })
    }).toThrow('FORBIDDEN')
  })
  test('softDelete: rm marks deletedAt; restore brings row back; set on deleted clears it', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeKv(
      { reducer },
      {
        fields: {},
        keyField: {} as never,
        options: { softDelete: true },
        table: () => tbl as never,
        tableName: 'config'
      }
    )
    const setFn = reducers.set_config as (c: never, a: never) => void
    const rmFn = reducers.rm_config as (c: never, a: never) => void
    const restoreFn = reducers.restore_config as (c: never, a: never) => void
    setFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { key: 'k', message: 'v1' } as never)
    rmFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(1) } as never, { key: 'k' } as never)
    expect(rows[0]?.deletedAt).toBeTruthy()
    restoreFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(2) } as never, { key: 'k' } as never)
    expect(rows[0]?.deletedAt).toBeNull()
    rmFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(3) } as never, { key: 'k' } as never)
    setFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(4) } as never, { key: 'k', message: 'v2' } as never)
    expect((rows[0] as unknown as { deletedAt?: unknown }).deletedAt).toBeNull()
  })
  test('writeRole=false rejects rm + restore', () => {
    const { reducer, reducers } = captureReducers()
    const { tbl } = mkTable()
    makeKv(
      { reducer },
      {
        fields: {},
        keyField: {} as never,
        options: { softDelete: true },
        table: () => tbl as never,
        tableName: 'config',
        writeRole: () => false
      }
    )
    const rmFn = reducers.rm_config as (c: never, a: never) => void
    const restoreFn = reducers.restore_config as (c: never, a: never) => void
    expect(() => {
      rmFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { key: 'k' } as never)
    }).toThrow('FORBIDDEN')
    expect(() => {
      restoreFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { key: 'k' } as never)
    }).toThrow('FORBIDDEN')
  })
  test('rm hard-deletes when softDelete=false', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeKv(
      { reducer },
      {
        fields: {},
        keyField: {} as never,
        table: () => tbl as never,
        tableName: 'config'
      }
    )
    const setFn = reducers.set_config as (c: never, a: never) => void
    const rmFn = reducers.rm_config as (c: never, a: never) => void
    setFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(0) } as never, { key: 'r' } as never)
    rmFn({ db: {}, sender: senderIdent, timestamp: tsAtMs(10) } as never, { key: 'r' } as never)
    expect(rows).toHaveLength(0)
  })
})
