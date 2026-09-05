/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { describe, expect, test } from 'bun:test'
import type { IdentityFake, Ts } from './_helpers'
import { makeChildCrud } from '../child'
import { captureReducers, ident, tsAtMs } from './_helpers'

interface ChildRow {
  chatId: number
  createdAt: Ts
  id: number
  text?: string
  updatedAt: Ts
  userId: IdentityFake
}
interface ParentRow {
  id: number
  userId: IdentityFake
}
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
  test('beforeUpdate/afterUpdate hooks fire on update', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkChildTable()
    const parent = mkParentTable()
    parent.rows.push({ id: 1, userId: ident('me') })
    let beforeFired = false
    let afterFired = false
    makeChildCrud(
      { reducer },
      {
        fields: { text: { optional: () => ({}) } as never },
        foreignKeyField: {} as never,
        foreignKeyName: 'chatId',
        idField: {} as never,
        options: {
          hooks: {
            afterUpdate: () => {
              afterFired = true
            },
            beforeUpdate: (_c, a) => {
              beforeFired = true
              return a.patch
            }
          }
        },
        parentPk: t => (t as unknown as { id: never }).id,
        parentTable: () => parent.tbl as never,
        pk: t => (t as unknown as { id: never }).id,
        table: () => tbl as never,
        tableName: 'message'
      }
    )
    const createFn = reducers.create_message as (c: never, a: never) => void
    const updateFn = reducers.update_message as (c: never, a: never) => void
    createFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(0) } as never, { chatId: 1, text: 'a' } as never)
    updateFn({ db: {}, sender: ident('me'), timestamp: tsAtMs(1) } as never, { id: 1, text: 'b' } as never)
    expect(beforeFired).toBe(true)
    expect(afterFired).toBe(true)
    expect(rows[0]?.text).toBe('b')
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
