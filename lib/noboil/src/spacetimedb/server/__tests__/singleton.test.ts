import { describe, expect, test } from 'bun:test'
import type { Ts } from './_helpers'
import { makeSingletonCrud } from '../singleton'
import { captureReducers, ident, tsAtMs } from './_helpers'

interface SingletonRow {
  bio?: string
  id: number
  name?: string
  updatedAt: Ts
  userId: { isEqual: (o: unknown) => boolean }
}
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
  test('hooks fire on get/upsert (read, create, update)', () => {
    const { reducer, reducers } = captureReducers()
    const { tbl } = mkTable()
    const calls: string[] = []
    makeSingletonCrud(
      { reducer },
      {
        fields: { name: { optional: () => ({}) } as never },
        options: {
          hooks: {
            afterCreate: () => {
              calls.push('afterCreate')
            },
            afterUpdate: () => {
              calls.push('afterUpdate')
            },
            beforeCreate: (_c, p) => {
              calls.push('beforeCreate')
              return p.data
            },
            beforeRead: () => {
              calls.push('beforeRead')
            },
            beforeUpdate: (_c, p) => {
              calls.push('beforeUpdate')
              return p.patch
            }
          }
        },
        table: () => tbl as never,
        tableName: 'profile'
      }
    )
    const upsertFn = reducers.upsert_profile as (c: never, a: never) => void
    const getFn = reducers.get_profile as (c: never) => void
    const u = ident('u')
    upsertFn({ db: {}, sender: u, timestamp: tsAtMs(0) } as never, { name: 'A' } as never)
    upsertFn({ db: {}, sender: u, timestamp: tsAtMs(1) } as never, { name: 'B' } as never)
    getFn({ db: {}, sender: u, timestamp: tsAtMs(2) } as never)
    expect(calls).toEqual(['beforeCreate', 'afterCreate', 'beforeUpdate', 'afterUpdate', 'beforeRead'])
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
