import { describe, expect, test } from 'bun:test'
import {
  addUrls,
  dbDelete,
  dbInsert,
  dbPatch,
  enforceRateLimit,
  idFromWire,
  idToWire,
  isErrorCode,
  isMutationError,
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
