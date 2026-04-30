import { describe, expect, test } from 'bun:test'
import { makeCrud } from '../crud'
interface OwnedRow {
  createdAt: { microsSinceUnixEpoch: bigint }
  done?: boolean
  id: number
  title?: string
  updatedAt: { microsSinceUnixEpoch: bigint }
  userId: { __id: string; isEqual: (o: unknown) => boolean }
}
const ident = (label: string) =>
  ({ __id: label, isEqual: (o: unknown) => (o as { __id?: string }).__id === label }) as never
const mkTable = () => {
  const rows: OwnedRow[] = []
  let nextId = 1
  const tbl = {
    [Symbol.iterator]: () => rows[Symbol.iterator](),
    id: {
      delete: (id: number) => {
        const idx = rows.findIndex(r => r.id === id)
        if (idx === -1) return false
        rows.splice(idx, 1)
        return true
      },
      find: (id: number) => rows.find(r => r.id === id),
      update: (row: OwnedRow) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx !== -1) rows[idx] = row
        return row
      }
    },
    insert: (row: OwnedRow) => {
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
describe('stdb makeCrud', () => {
  test('create inserts a new row tied to ctx.sender', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeCrud(
      { reducer },
      {
        fields: { done: { optional: () => ({}) } as never, title: { optional: () => ({}) } as never },
        idField: {} as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'todo'
      }
    )
    const createFn = reducers.create_todo as (c: never, a: never) => void
    createFn({ db: {}, sender: ident('user-A'), timestamp: tsAtMs(0) } as never, { done: false, title: 'first' } as never)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe('first')
    expect(rows[0]?.userId.__id).toBe('user-A')
  })
  test('update by id only allowed for owner; FORBIDDEN otherwise', () => {
    const { reducer, reducers } = captureReducers()
    const { tbl } = mkTable()
    makeCrud(
      { reducer },
      {
        fields: { title: { optional: () => ({}) } as never },
        idField: {} as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'todo'
      }
    )
    const createFn = reducers.create_todo as (c: never, a: never) => void
    const updateFn = reducers.update_todo as (c: never, a: never) => void
    createFn({ db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never, { title: 'orig' } as never)
    expect(() => {
      updateFn({ db: {}, sender: ident('intruder'), timestamp: tsAtMs(10) } as never, { id: 1, title: 'hacked' } as never)
    }).toThrow(/FORBIDDEN|NOT_FOUND/u)
  })
  test('rm removes own row', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makeCrud(
      { reducer },
      {
        fields: { title: { optional: () => ({}) } as never },
        idField: {} as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'todo'
      }
    )
    const createFn = reducers.create_todo as (c: never, a: never) => void
    const rmFn = reducers.rm_todo as (c: never, a: never) => void
    const owner = ident('me')
    createFn({ db: {}, sender: owner, timestamp: tsAtMs(0) } as never, { title: 'x' } as never)
    expect(rows).toHaveLength(1)
    const rowId = rows[0]?.id ?? -1
    rmFn({ db: {}, sender: owner, timestamp: tsAtMs(10) } as never, { id: rowId } as never)
    expect(rows).toHaveLength(0)
  })
  test('update mutates own row + fires hooks; rm soft-deletes when softDelete option set', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    const calls: string[] = []
    makeCrud(
      { reducer },
      {
        fields: { title: { optional: () => ({}) } as never },
        idField: {} as never,
        options: {
          hooks: {
            afterCreate: () => {
              calls.push('afterCreate')
            },
            afterDelete: () => {
              calls.push('afterDelete')
            },
            afterUpdate: () => {
              calls.push('afterUpdate')
            },
            beforeCreate: (_c, p) => {
              calls.push('beforeCreate')
              return p.data
            },
            beforeDelete: () => {
              calls.push('beforeDelete')
            },
            beforeUpdate: (_c, p) => {
              calls.push('beforeUpdate')
              return p.patch
            }
          },
          softDelete: true
        },
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'todo'
      }
    )
    const createFn = reducers.create_todo as (c: never, a: never) => void
    const updateFn = reducers.update_todo as (c: never, a: never) => void
    const rmFn = reducers.rm_todo as (c: never, a: never) => void
    const owner = ident('me')
    createFn({ db: {}, sender: owner, timestamp: tsAtMs(0) } as never, { title: 'orig' } as never)
    updateFn({ db: {}, sender: owner, timestamp: tsAtMs(10) } as never, { id: 1, title: 'new' } as never)
    expect(rows[0]?.title).toBe('new')
    rmFn({ db: {}, sender: owner, timestamp: tsAtMs(20) } as never, { id: 1 } as never)
    expect(rows).toHaveLength(1)
    expect((rows[0] as unknown as { deletedAt?: unknown }).deletedAt).toBeDefined()
    expect(calls).toEqual(['beforeCreate', 'afterCreate', 'beforeUpdate', 'afterUpdate', 'beforeDelete', 'afterDelete'])
  })
  test('update CONFLICT when expectedUpdatedAt mismatches', () => {
    const { reducer, reducers } = captureReducers()
    const { tbl } = mkTable()
    makeCrud(
      { reducer },
      {
        fields: { title: { optional: () => ({}) } as never },
        idField: {} as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'todo'
      }
    )
    const createFn = reducers.create_todo as (c: never, a: never) => void
    const updateFn = reducers.update_todo as (c: never, a: never) => void
    createFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(0) } as never, { title: 'a' } as never)
    expect(() => {
      updateFn(
        { db: {}, sender: ident('me'), timestamp: tsAtMs(10) } as never,
        { expectedUpdatedAt: tsAtMs(99), id: 1, title: 'b' } as never
      )
    }).toThrow(/CONFLICT/u)
  })
})
