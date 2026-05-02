import { describe, expect, test } from 'bun:test'
import {
  addUrls,
  checkRateLimit,
  dbDelete,
  dbInsert,
  dbPatch,
  enforceRateLimit,
  getUser,
  idFromWire,
  idToWire,
  isErrorCode,
  isMutationError,
  makeUnique,
  normalizeRateLimit,
  ownGet,
  readCtx,
  resetRateLimitState
} from '../helpers'
const ident = (label: string) =>
  ({ __id: label, isEqual: (o: unknown) => (o as { __id?: string }).__id === label, toHexString: () => label }) as never
describe('stdb helpers', () => {
  test('idToWire stringifies, idFromWire parses', () => {
    expect(idToWire(42)).toBe('42')
    expect(idFromWire('42')).toBe(42)
  })
  test('idFromWire throws on invalid input', () => {
    expect(() => idFromWire('')).toThrow()
    expect(() => idFromWire('abc')).toThrow()
  })
  test('ownGet returns doc when userId matches; throws NOT_FOUND otherwise', async () => {
    const doc = { _id: 'r1', userId: 'u1' }
    const db = {
      get: async (id: string) => (id === 'r1' ? doc : null)
    }
    const get = ownGet(db as never, 'u1')
    await expect(get('r1')).resolves.toEqual(doc)
    const get2 = ownGet(db as never, 'u2')
    await expect(get2('r1')).rejects.toThrow(/NOT_FOUND/u)
  })
  test('readCtx withAuthor enriches docs with author + own', async () => {
    const users = new Map([
      ['u1', { _id: 'u1', name: 'Alice' }],
      ['u2', { _id: 'u2', name: 'Bob' }]
    ])
    const db = { get: async (id: string) => users.get(id) ?? null }
    const ctx = readCtx({ db: db as never, storage: {} as never, viewerId: 'u1' })
    const out = await ctx.withAuthor([
      { id: 'a', userId: 'u1' },
      { id: 'b', userId: 'u2' }
    ])
    expect(out[0]?.own).toBe(true)
    expect(out[1]?.own).toBe(false)
    expect(out[0]?.author).toEqual(users.get('u1') as never)
  })
  test('isErrorCode + isMutationError reject plain errors', () => {
    expect(isMutationError(new Error('boom'))).toBe(false)
    expect(isErrorCode(new Error('boom'), 'X')).toBe(false)
  })
  test('normalizeRateLimit number → object', () => {
    expect(normalizeRateLimit(10)).toEqual({ max: 10, window: 60_000 })
    expect(normalizeRateLimit({ max: 5, window: 1000 })).toEqual({ max: 5, window: 1000 })
  })
  test('addUrls returns doc unchanged for empty fileFields', async () => {
    const doc = { _id: 'r', title: 't' }
    const out = await addUrls({
      doc,
      fileFields: [],
      storage: { delete: async () => undefined, getUrl: async () => null }
    })
    expect(out).toEqual(doc as never)
  })
  test('addUrls adds {field}Url + {field}Urls for single + array', async () => {
    const storage = {
      delete: async () => undefined,
      getUrl: async (id: string) => `u/${id}`
    } as never
    const out = (await addUrls({
      doc: { avatar: 'a1', gallery: ['g1', 'g2'], missing: null },
      fileFields: ['avatar', 'gallery', 'missing'],
      storage
    })) as { avatarUrl?: string; galleryUrls?: (null | string)[]; missingUrl?: string }
    expect(out.avatarUrl).toBe('u/a1')
    expect(out.galleryUrls).toEqual(['u/g1', 'u/g2'])
    expect(out.missingUrl).toBeUndefined()
  })
  test('enforceRateLimit allows up to max, throws RATE_LIMITED beyond', () => {
    resetRateLimitState()
    const sender = ident('id-1')
    enforceRateLimit('todo', sender, { max: 2, window: 60_000 }, 1000)
    enforceRateLimit('todo', sender, { max: 2, window: 60_000 }, 1100)
    expect(() => enforceRateLimit('todo', sender, { max: 2, window: 60_000 }, 1200)).toThrow(/RATE_LIMITED/u)
    enforceRateLimit('todo', sender, { max: 2, window: 60_000 }, 1000 + 60_001)
    resetRateLimitState()
  })
  test('getUser resolves via sender identity hex when present', async () => {
    const sender = ident('me')
    const u = { _id: 'me', name: 'Alice' }
    const db = { get: async (id: string) => (id === 'me' ? u : null) } as never
    const ctx = { sender } as never
    const res = await getUser({ ctx, db, getAuthUserId: async () => null })
    expect(res._id).toBe('me')
  })
  test('getUser falls back to getAuthUserId when no sender', async () => {
    const db = { get: async (id: string) => ({ _id: id, name: 'B' }) } as never
    const ctx = {} as never
    const res = await getUser({ ctx, db, getAuthUserId: async () => 'u-2' })
    expect(res._id).toBe('u-2')
  })
  test('getUser throws NOT_AUTHENTICATED when no sender + no auth', async () => {
    const db = { get: async () => null } as never
    const ctx = {} as never
    await expect(getUser({ ctx, db, getAuthUserId: async () => null })).rejects.toThrow(/NOT_AUTHENTICATED/u)
  })
  test('getUser throws USER_NOT_FOUND when user missing in db', async () => {
    const db = { get: async () => null } as never
    const ctx = {} as never
    await expect(getUser({ ctx, db, getAuthUserId: async () => 'absent' })).rejects.toThrow(/USER_NOT_FOUND/u)
  })
  test('checkRateLimit inserts on first call, patches reset after window, patches count, throws RATE_LIMITED at max', async () => {
    let row: null | Record<string, unknown> = null
    const db = {
      delete: async () => undefined,
      get: async () => null,
      insert: async (_t: string, data: Record<string, unknown>) => {
        row = { _id: 'rl-1', ...data }
        return 'rl-1'
      },
      patch: async (_id: string, data: Record<string, unknown>) => {
        if (row) Object.assign(row, data)
      },
      query: () => ({
        withIndex: (_name: string, build: (q: unknown) => unknown) => {
          build({
            eq: (_field: string, _value: unknown) => ({ eq: (_f: string, _v: unknown) => undefined })
          })
          return { first: async () => row }
        }
      })
    } as never
    const cfg = { max: 2, window: 60_000 }
    await checkRateLimit(db, { config: cfg, key: 'u', table: 't', timestamp: 1000 })
    expect((row as null | Record<string, unknown>)?.count).toBe(1)
    await checkRateLimit(db, { config: cfg, key: 'u', table: 't', timestamp: 1500 })
    expect((row as null | Record<string, unknown>)?.count).toBe(2)
    await expect(checkRateLimit(db, { config: cfg, key: 'u', table: 't', timestamp: 2000 })).rejects.toThrow(
      /RATE_LIMITED/u
    )
    await checkRateLimit(db, { config: cfg, key: 'u', table: 't', timestamp: 1000 + 60_001 })
    expect((row as null | Record<string, unknown>)?.count).toBe(1)
  })
  test('makeUnique returns true when no existing row, false when present and not excluded', async () => {
    let captured: ((c: unknown, a: unknown) => unknown) | undefined
    const pq = ((opts: { handler: (c: unknown, a: unknown) => unknown }) => {
      captured = opts.handler
      return opts.handler
    }) as never
    makeUnique({ field: 'slug', index: 'by_slug', pq, table: 'org' })
    if (!captured) throw new Error('handler not captured')
    let firstResult: null | Record<string, unknown> = null
    const ctx = {
      db: {
        query: () => ({
          filter: () => ({ first: async () => firstResult }),
          withIndex: () => ({ first: async () => firstResult })
        })
      }
    }
    const noneFound = (await captured(ctx, { value: 'foo' })) as boolean
    expect(noneFound).toBe(true)
    firstResult = { _id: 'org-1', slug: 'foo' }
    const found = (await captured(ctx, { value: 'foo' })) as boolean
    expect(found).toBe(false)
    const excluded = (await captured(ctx, { exclude: 'org-1', value: 'foo' })) as boolean
    expect(excluded).toBe(true)
  })
  test('makeUnique without index uses filter path', async () => {
    let captured: ((c: unknown, a: unknown) => unknown) | undefined
    const pq = ((opts: { handler: (c: unknown, a: unknown) => unknown }) => {
      captured = opts.handler
      return opts.handler
    }) as never
    makeUnique({ field: 'slug', pq, table: 'org' })
    if (!captured) throw new Error('handler not captured')
    const ctx = {
      db: {
        query: () => ({
          filter: () => ({ first: async () => null })
        })
      }
    }
    const r = (await captured(ctx, { value: 'x' })) as boolean
    expect(r).toBe(true)
  })
  test('dbInsert/dbPatch/dbDelete proxy to db methods', async () => {
    const calls: { args: unknown[]; op: string }[] = []
    const db = {
      delete: async (...args: unknown[]) => {
        calls.push({ args, op: 'delete' })
      },
      insert: async (...args: unknown[]) => {
        calls.push({ args, op: 'insert' })
        return 'new-id'
      },
      patch: async (...args: unknown[]) => {
        calls.push({ args, op: 'patch' })
      }
    } as never
    expect(await dbInsert(db, 'todo', { title: 'a' })).toBe('new-id')
    await dbPatch(db, 'r1', { done: true })
    await dbDelete(db, 'r1')
    expect(calls.map(c => c.op)).toEqual(['insert', 'patch', 'delete'])
  })
})
