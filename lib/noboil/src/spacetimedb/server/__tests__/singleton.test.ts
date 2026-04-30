import { describe, expect, test } from 'bun:test'
import { makeSingletonCrud } from '../singleton'
interface SingletonRow {
  bio?: string
  id: number
  name?: string
  updatedAt: { microsSinceUnixEpoch: bigint }
  userId: { isEqual: (o: unknown) => boolean }
}
const ident = (label: string) =>
  ({ __id: label, isEqual: (o: unknown) => (o as { __id?: string }).__id === label }) as never
const mkTable = () => {
  const rows: SingletonRow[] = []
  let nextId = 1
  const tbl = {
    [Symbol.iterator]: () => rows[Symbol.iterator](),
    id: {
      delete: (id: number) => {
        const idx = rows.findIndex(r => r.id === id)
        if (idx !== -1) rows.splice(idx, 1)
      },
      update: (row: SingletonRow) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx !== -1) rows[idx] = row
        return row
      }
    },
    insert: (row: SingletonRow) => {
      const next = { ...row, id: nextId }
      nextId += 1
      rows.push(next)
      return next
    }
  }
  return { rows, tbl }
}
const tsAtMs = (ms: number) => ({ microsSinceUnixEpoch: BigInt(ms) * 1000n }) as never
const captureReducers = () => {
  const out: Record<string, unknown> = {}
  const reducer = (opts: { name: string }, _params: unknown, fn: unknown) => {
    out[opts.name] = fn
    return fn
  }
  return { reducer, reducers: out }
}
describe('stdb makeSingletonCrud', () => {
  test('upsert creates row when none exists', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeSingletonCrud(
      { reducer },
      {
        fields: { bio: { optional: () => ({}) } as never, name: { optional: () => ({}) } as never },
        table: () => tbl as never,
        tableName: 'profile'
      }
    )
    const upsertFn = reducers.upsert_profile as (c: never, a: never) => void
    upsertFn({ db: {}, sender: ident('u-1'), timestamp: tsAtMs(0) } as never, { bio: 'b', name: 'Alice' } as never)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('Alice')
  })
  test('upsert updates row when exists for same userId', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeSingletonCrud(
      { reducer },
      {
        fields: { name: { optional: () => ({}) } as never },
        table: () => tbl as never,
        tableName: 'profile'
      }
    )
    const upsertFn = reducers.upsert_profile as (c: never, a: never) => void
    const sameUser = ident('u-2')
    upsertFn({ db: {}, sender: sameUser, timestamp: tsAtMs(0) } as never, { name: 'first' } as never)
    upsertFn({ db: {}, sender: sameUser, timestamp: tsAtMs(10) } as never, { name: 'second' } as never)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('second')
  })
  test('get throws NOT_FOUND when no row for the user', () => {
    const { reducer, reducers } = captureReducers()
    const { tbl } = mkTable()
    makeSingletonCrud(
      { reducer },
      {
        fields: { name: { optional: () => ({}) } as never },
        table: () => tbl as never,
        tableName: 'profile'
      }
    )
    const getFn = reducers.get_profile as (c: never) => void
    expect(() => {
      getFn({ db: {}, sender: ident('absent'), timestamp: tsAtMs(0) } as never)
    }).toThrow('NOT_FOUND')
  })
})
