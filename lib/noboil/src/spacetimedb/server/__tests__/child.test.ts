import { describe, expect, test } from 'bun:test'
import { makeChildCrud } from '../child'
interface ChildRow {
  chatId: number
  createdAt: { microsSinceUnixEpoch: bigint }
  id: number
  text?: string
  updatedAt: { microsSinceUnixEpoch: bigint }
  userId: { __id: string; isEqual: (o: unknown) => boolean }
}
interface ParentRow {
  id: number
  userId: { __id: string; isEqual: (o: unknown) => boolean }
}
const ident = (label: string) =>
  ({ __id: label, isEqual: (o: unknown) => (o as { __id?: string }).__id === label }) as never
const mkChildTable = () => {
  const rows: ChildRow[] = []
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
      update: (row: ChildRow) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx !== -1) rows[idx] = row
        return row
      }
    },
    insert: (row: ChildRow) => {
      const next = { ...row, id: nextId }
      nextId += 1
      rows.push(next)
      return next
    }
  }
  return { rows, tbl }
}
const mkParentTable = () => {
  const rows: ParentRow[] = []
  return {
    rows,
    tbl: {
      [Symbol.iterator]: () => rows[Symbol.iterator](),
      id: {
        find: (id: number) => rows.find(r => r.id === id)
      }
    }
  }
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
describe('stdb makeChildCrud', () => {
  test('create rejects when parent missing', () => {
    const { reducer, reducers } = captureReducers()
    const { tbl } = mkChildTable()
    const parent = mkParentTable()
    makeChildCrud(
      { reducer },
      {
        fields: { text: { optional: () => ({}) } as never },
        foreignKeyField: {} as never,
        foreignKeyName: 'chatId',
        idField: {} as never,
        parentPk: t => (t as unknown as { id: never }).id,
        parentTable: () => parent.tbl as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'message'
      }
    )
    const createFn = reducers.create_message as (c: never, a: never) => void
    expect(() => {
      createFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(0) } as never, { chatId: 999, text: 'hi' } as never)
    }).toThrow('NOT_FOUND')
  })
  test('update mutates own child; FORBIDDEN for non-owner', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkChildTable()
    const parent = mkParentTable()
    parent.rows.push({ id: 1, userId: ident('me') })
    makeChildCrud(
      { reducer },
      {
        fields: { text: { optional: () => ({}) } as never },
        foreignKeyField: {} as never,
        foreignKeyName: 'chatId',
        idField: {} as never,
        parentPk: t => (t as unknown as { id: never }).id,
        parentTable: () => parent.tbl as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'message'
      }
    )
    const createFn = reducers.create_message as (c: never, a: never) => void
    const updateFn = reducers.update_message as (c: never, a: never) => void
    createFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(0) } as never, { chatId: 1, text: 'orig' } as never)
    updateFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(1) } as never, { id: 1, text: 'edit' } as never)
    expect(rows[0]?.text).toBe('edit')
    expect(() => {
      updateFn({ db: {}, sender: ident('foe'), timestamp: tsAtMs(2) } as never, { id: 1, text: 'hax' } as never)
    }).toThrow(/FORBIDDEN/u)
  })
  test('rm soft-deletes when softDelete option set', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkChildTable()
    const parent = mkParentTable()
    parent.rows.push({ id: 1, userId: ident('me') })
    makeChildCrud(
      { reducer },
      {
        fields: { text: { optional: () => ({}) } as never },
        foreignKeyField: {} as never,
        foreignKeyName: 'chatId',
        idField: {} as never,
        options: { softDelete: true },
        parentPk: t => (t as unknown as { id: never }).id,
        parentTable: () => parent.tbl as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'message'
      }
    )
    const createFn = reducers.create_message as (c: never, a: never) => void
    const rmFn = reducers.rm_message as (c: never, a: never) => void
    createFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(0) } as never, { chatId: 1, text: 'soft' } as never)
    rmFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(5) } as never, { id: 1 } as never)
    expect(rows).toHaveLength(1)
    expect((rows[0] as unknown as { deletedAt?: unknown }).deletedAt).toBeDefined()
  })
  test('rm hard-deletes own row', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkChildTable()
    const parent = mkParentTable()
    parent.rows.push({ id: 1, userId: ident('me') })
    makeChildCrud(
      { reducer },
      {
        fields: { text: { optional: () => ({}) } as never },
        foreignKeyField: {} as never,
        foreignKeyName: 'chatId',
        idField: {} as never,
        parentPk: t => (t as unknown as { id: never }).id,
        parentTable: () => parent.tbl as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'message'
      }
    )
    const createFn = reducers.create_message as (c: never, a: never) => void
    const rmFn = reducers.rm_message as (c: never, a: never) => void
    createFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(0) } as never, { chatId: 1, text: 'gone' } as never)
    rmFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(5) } as never, { id: 1 } as never)
    expect(rows).toHaveLength(0)
  })
  test('create succeeds when parent exists', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkChildTable()
    const parent = mkParentTable()
    parent.rows.push({ id: 1, userId: ident('me') })
    makeChildCrud(
      { reducer },
      {
        fields: { text: { optional: () => ({}) } as never },
        foreignKeyField: {} as never,
        foreignKeyName: 'chatId',
        idField: {} as never,
        parentPk: t => (t as unknown as { id: never }).id,
        parentTable: () => parent.tbl as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'message'
      }
    )
    const createFn = reducers.create_message as (c: never, a: never) => void
    createFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(0) } as never, { chatId: 1, text: 'hello' } as never)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.text).toBe('hello')
    expect(rows[0]?.chatId).toBe(1)
  })
})
