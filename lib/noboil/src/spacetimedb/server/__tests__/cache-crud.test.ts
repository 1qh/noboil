import { describe, expect, test } from 'bun:test'
import type { Ts } from './_helpers'
import { makeCacheCrud } from '../cache-crud'
import { captureReducers } from './_helpers'
interface MovieRow {
  rating?: number
  title?: string
  tmdb_id: string
  updatedAt: Ts
}
const mkTable = () => {
  const rows: MovieRow[] = []
  const tbl = {
    [Symbol.iterator]: () => rows[Symbol.iterator](),
    insert: (row: MovieRow) => {
      rows.push(row)
      return row
    },
    tmdb_id: {
      delete: (id: string) => {
        const idx = rows.findIndex(r => r.tmdb_id === id)
        if (idx === -1) return false
        rows.splice(idx, 1)
        return true
      },
      find: (id: string) => rows.find(r => r.tmdb_id === id),
      update: (row: MovieRow) => {
        const idx = rows.findIndex(r => r.tmdb_id === row.tmdb_id)
        if (idx !== -1) rows[idx] = row
        return row
      }
    }
  }
  return { rows, tbl }
}
const tsAtMs = (ms: number) => ({ microsSinceUnixEpoch: BigInt(ms) * 1000n, valueOf: () => ms }) as never
describe('stdb makeCacheCrud', () => {
  test('create inserts a new row when key is not present', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeCacheCrud(
      { reducer },
      {
        fields: {
          rating: { optional: () => ({}) } as never,
          title: { optional: () => ({}) } as never
        },
        keyField: {} as never,
        keyName: 'tmdb_id',
        pk: t => (t as unknown as { tmdb_id: never }).tmdb_id,
        table: () => tbl as never,
        tableName: 'movie'
      }
    )
    const createFn = reducers.create_movie as (c: never, a: never) => void
    createFn(
      { db: {}, sender: {} as never, timestamp: tsAtMs(0) } as never,
      { rating: 8, title: 'M', tmdb_id: 'k1' } as never
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe('M')
  })
  test('update mutates row by key', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeCacheCrud(
      { reducer },
      {
        fields: {
          rating: { optional: () => ({}) } as never,
          title: { optional: () => ({}) } as never
        },
        keyField: {} as never,
        keyName: 'tmdb_id',
        pk: t => (t as unknown as { tmdb_id: never }).tmdb_id,
        table: () => tbl as never,
        tableName: 'movie'
      }
    )
    const createFn = reducers.create_movie as (c: never, a: never) => void
    const updateFn = reducers.update_movie as (c: never, a: never) => void
    createFn(
      { db: {}, sender: {} as never, timestamp: tsAtMs(0) } as never,
      { rating: 5, title: 'V1', tmdb_id: 'same' } as never
    )
    updateFn(
      { db: {}, sender: {} as never, timestamp: tsAtMs(10) } as never,
      { rating: 9, title: 'V2', tmdb_id: 'same' } as never
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe('V2')
    expect(rows[0]?.rating).toBe(9)
  })
  test('rm removes by key', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeCacheCrud(
      { reducer },
      {
        fields: { title: { optional: () => ({}) } as never },
        keyField: {} as never,
        keyName: 'tmdb_id',
        pk: t => (t as unknown as { tmdb_id: never }).tmdb_id,
        table: () => tbl as never,
        tableName: 'movie'
      }
    )
    const createFn = reducers.create_movie as (c: never, a: never) => void
    const rmFn = reducers.rm_movie as (c: never, a: never) => void
    createFn({ db: {}, sender: {} as never, timestamp: tsAtMs(0) } as never, { title: 'x', tmdb_id: 'gone' } as never)
    rmFn({ db: {}, sender: {} as never, timestamp: tsAtMs(10) } as never, { tmdb_id: 'gone' } as never)
    expect(rows).toHaveLength(0)
  })
  test('invalidate marks invalidatedAt; purge removes expired rows', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeCacheCrud(
      { reducer },
      {
        fields: { rating: { optional: () => ({}) } as never, title: { optional: () => ({}) } as never },
        keyField: {} as never,
        keyName: 'tmdb_id',
        options: { ttl: 5 },
        pk: t => (t as unknown as { tmdb_id: never }).tmdb_id,
        table: () => tbl as never,
        tableName: 'movie'
      }
    )
    const createFn = reducers.create_movie as (c: never, a: never) => void
    const invalidateFn = reducers.invalidate_movie as (c: never, a: never) => void
    const purgeFn = reducers.purge_movie as (c: never, a: never) => void
    createFn(
      { db: {}, sender: {} as never, timestamp: tsAtMs(0) } as never,
      { rating: 5, title: 'A', tmdb_id: 'k' } as never
    )
    invalidateFn({ db: {}, sender: {} as never, timestamp: tsAtMs(1) } as never, { tmdb_id: 'k' } as never)
    expect((rows[0] as unknown as { invalidatedAt?: unknown }).invalidatedAt).toBeDefined()
    purgeFn({ db: {}, sender: {} as never, timestamp: tsAtMs(1000) } as never, {} as never)
    expect(rows).toHaveLength(0)
  })
  test('purge with timestamp.toJSON returning ISO string parses via parseTimestampText', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeCacheCrud(
      { reducer },
      {
        fields: { title: { optional: () => ({}) } as never },
        keyField: {} as never,
        keyName: 'tmdb_id',
        options: { ttl: 1 },
        pk: t => (t as unknown as { tmdb_id: never }).tmdb_id,
        table: () => tbl as never,
        tableName: 'movie'
      }
    )
    const createFn = reducers.create_movie as (c: never, a: never) => void
    const purgeFn = reducers.purge_movie as (c: never, a: never) => void
    const tsJson = (iso: string) => ({ toJSON: () => iso }) as never
    createFn(
      { db: {}, sender: {} as never, timestamp: tsJson('2020-01-01T00:00:00Z') } as never,
      {
        title: 'old',
        tmdb_id: 'j1'
      } as never
    )
    purgeFn({ db: {}, sender: {} as never, timestamp: tsJson('2025-01-01T00:00:00Z') } as never, {} as never)
    expect(rows.length).toBe(0)
  })
  test('purge with timestamp.toString returning numeric string parses via parseTimestampValue', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeCacheCrud(
      { reducer },
      {
        fields: { title: { optional: () => ({}) } as never },
        keyField: {} as never,
        keyName: 'tmdb_id',
        options: { ttl: 1 },
        pk: t => (t as unknown as { tmdb_id: never }).tmdb_id,
        table: () => tbl as never,
        tableName: 'movie'
      }
    )
    const createFn = reducers.create_movie as (c: never, a: never) => void
    const purgeFn = reducers.purge_movie as (c: never, a: never) => void
    const tsStr = (s: string) => ({ toString: () => s }) as never
    createFn(
      { db: {}, sender: {} as never, timestamp: tsStr('1000') } as never,
      {
        title: 'old',
        tmdb_id: 'j2'
      } as never
    )
    purgeFn({ db: {}, sender: {} as never, timestamp: tsStr('99999999999') } as never, {} as never)
    expect(rows.length).toBe(0)
  })
  test('update NOT_FOUND on missing key', () => {
    const { reducer, reducers } = captureReducers()
    const { tbl } = mkTable()
    makeCacheCrud(
      { reducer },
      {
        fields: { title: { optional: () => ({}) } as never },
        keyField: {} as never,
        keyName: 'tmdb_id',
        pk: t => (t as unknown as { tmdb_id: never }).tmdb_id,
        table: () => tbl as never,
        tableName: 'movie'
      }
    )
    const updateFn = reducers.update_movie as (c: never, a: never) => void
    expect(() => {
      updateFn({ db: {}, sender: {} as never, timestamp: tsAtMs(0) } as never, { title: 'X', tmdb_id: 'absent' } as never)
    }).toThrow(/NOT_FOUND/u)
  })
})
