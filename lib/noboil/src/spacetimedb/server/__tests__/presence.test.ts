import { describe, expect, test } from 'bun:test'
import { makePresence } from '../presence'
interface PresenceRow {
  data?: unknown
  expiresAt: { microsSinceUnixEpoch: bigint }
  id: number
  lastSeenAt: { microsSinceUnixEpoch: bigint }
  roomId: string
  userId: { __id: string; isEqual: (o: unknown) => boolean }
}
const ident = (label: string) =>
  ({ __id: label, isEqual: (o: unknown) => (o as { __id?: string }).__id === label }) as never
const mkTable = () => {
  const rows: PresenceRow[] = []
  let nextId = 1
  const tbl = {
    id: {
      delete: (id: number) => {
        const idx = rows.findIndex(r => r.id === id)
        if (idx === -1) return false
        rows.splice(idx, 1)
        return true
      },
      find: (id: number) => rows.find(r => r.id === id),
      update: (row: PresenceRow) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx !== -1) rows[idx] = row
        return row
      }
    },
    insert: (row: PresenceRow) => {
      const next = { ...row, id: nextId }
      nextId += 1
      rows.push(next)
      return next
    },
    iter: () => rows[Symbol.iterator]()
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
describe('stdb makePresence', () => {
  test('heartbeat creates a new row when none exists', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makePresence(
      { reducer },
      {
        dataField: { optional: () => ({}) } as never,
        pk: t => (t as unknown as { id: never }).id,
        roomIdField: {} as never,
        table: () => tbl as never,
        tableName: 'presence'
      }
    )
    const heartbeatFn = reducers.presence_heartbeat_presence as (c: never, a: never) => void
    heartbeatFn({ db: {}, sender: ident('u1'), timestamp: tsAtMs(0) } as never, { data: null, roomId: 'r1' } as never)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.roomId).toBe('r1')
    expect(rows[0]?.userId.__id).toBe('u1')
  })
  test('heartbeat updates existing row instead of duplicating', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makePresence(
      { reducer },
      {
        dataField: { optional: () => ({}) } as never,
        pk: t => (t as unknown as { id: never }).id,
        roomIdField: {} as never,
        table: () => tbl as never,
        tableName: 'presence'
      }
    )
    const heartbeatFn = reducers.presence_heartbeat_presence as (c: never, a: never) => void
    const sender = ident('u2')
    heartbeatFn({ db: {}, sender, timestamp: tsAtMs(0) } as never, { data: null, roomId: 'r2' } as never)
    heartbeatFn({ db: {}, sender, timestamp: tsAtMs(1000) } as never, { data: { typing: true }, roomId: 'r2' } as never)
    expect(rows).toHaveLength(1)
  })
  test('leave removes the user-room row', () => {
    const { reducer, reducers } = captureReducers()
    const { rows, tbl } = mkTable()
    makePresence(
      { reducer },
      {
        dataField: { optional: () => ({}) } as never,
        pk: t => (t as unknown as { id: never }).id,
        roomIdField: {} as never,
        table: () => tbl as never,
        tableName: 'presence'
      }
    )
    const heartbeatFn = reducers.presence_heartbeat_presence as (c: never, a: never) => void
    const leaveFn = reducers.presence_leave_presence as (c: never, a: never) => void
    const sender = ident('u3')
    heartbeatFn({ db: {}, sender, timestamp: tsAtMs(0) } as never, { data: null, roomId: 'r3' } as never)
    leaveFn({ db: {}, sender, timestamp: tsAtMs(10) } as never, { roomId: 'r3' } as never)
    expect(rows).toHaveLength(0)
  })
})
