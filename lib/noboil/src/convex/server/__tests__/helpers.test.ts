import { describe, expect, test } from 'bun:test'
import { addUrls, checkRateLimit, makeUnique, normalizeRateLimit } from '../helpers'

const noopEq = () => undefined
const eqChain = () => ({ eq: noopEq })
const indexQueryStub = { eq: eqChain }
describe('convex helpers normalizeRateLimit', () => {
  test('number → { max, window: 60s }', () => {
    expect(normalizeRateLimit(10)).toEqual({ max: 10, window: 60_000 })
  })
  test('object passes through', () => {
    expect(normalizeRateLimit({ max: 5, window: 1000 })).toEqual({ max: 5, window: 1000 })
  })
})
describe('addUrls', () => {
  test('returns doc unchanged when no fileFields', async () => {
    const doc = { _id: 'r1', title: 't' }
    const out = await addUrls({ doc, fileFields: [], storage: { getUrl: async () => null } as never })
    expect(out).toEqual(doc as never)
  })
  test('adds {field}Url for single id, skips null', async () => {
    const storage = { getUrl: async (id: string) => `https://example/${id}` } as never
    const out = (await addUrls({
      doc: { avatar: 'storage-1', missing: null, title: 't' },
      fileFields: ['avatar', 'missing'],
      storage
    })) as { avatarUrl?: string; missingUrl?: string }
    expect(out.avatarUrl).toBe('https://example/storage-1')
    expect(out.missingUrl).toBeUndefined()
  })
  test('adds {field}Urls for array', async () => {
    const storage = { getUrl: async (id: string) => `u/${id}` } as never
    const out = (await addUrls({
      doc: { gallery: ['a', 'b'] },
      fileFields: ['gallery'],
      storage
    })) as { galleryUrls?: (null | string)[] }
    expect(out.galleryUrls).toEqual(['u/a', 'u/b'])
  })
})
describe('checkRateLimit', () => {
  const mkDb = (rowRef: { row: null | Record<string, unknown> }) =>
    ({
      delete: async () => undefined,
      get: async () => null,
      insert: async (_t: string, data: Record<string, unknown>) => {
        rowRef.row = { _id: 'rl-1', ...data }
        return 'rl-1'
      },
      patch: async (_id: string, data: Record<string, unknown>) => {
        if (rowRef.row) Object.assign(rowRef.row, data)
      },
      query: () => ({
        withIndex: (_name: string, build: (q: unknown) => unknown) => {
          build(indexQueryStub)
          return { first: async () => rowRef.row }
        }
      })
    }) as never
  test('inserts on first call', async () => {
    const ref = { row: null as null | Record<string, unknown> }
    const db = mkDb(ref)
    await checkRateLimit(db, { config: { max: 2, window: 60_000 }, key: 'k', table: 't' })
    expect(ref.row?.count).toBe(1)
  })
  test('throws RATE_LIMITED when count >= max within window', async () => {
    const ref = { row: { _id: 'rl-1', count: 5, key: 'k', table: 't', windowStart: Date.now() } }
    const db = mkDb(ref)
    await expect(checkRateLimit(db, { config: { max: 2, window: 60_000 }, key: 'k', table: 't' })).rejects.toThrow(
      /RATE_LIMITED/u
    )
  })
  test('resets count when window expired', async () => {
    const ref = { row: { _id: 'rl-1', count: 99, key: 'k', table: 't', windowStart: Date.now() - 70_000 } }
    const db = mkDb(ref)
    await checkRateLimit(db, { config: { max: 2, window: 60_000 }, key: 'k', table: 't' })
    expect(ref.row.count).toBe(1)
  })
  test('increments count when below max within window', async () => {
    const ref = { row: { _id: 'rl-1', count: 1, key: 'k', table: 't', windowStart: Date.now() } }
    const db = mkDb(ref)
    await checkRateLimit(db, { config: { max: 5, window: 60_000 }, key: 'k', table: 't' })
    expect(ref.row.count).toBe(2)
  })
})
describe('makeUnique', () => {
  test('returns true when no row, false when found, true when found but excluded', async () => {
    let captured: ((c: unknown, a: unknown) => unknown) | undefined
    const pq = ((opts: { handler: (c: unknown, a: unknown) => unknown }) => {
      captured = opts.handler
      return opts.handler
    }) as never
    makeUnique({ field: 'slug', index: 'by_slug', pq, table: 'org' })
    if (!captured) throw new Error('captured')
    let firstResult: null | Record<string, unknown> = null
    const ctx = {
      db: {
        query: () => ({
          filter: () => ({ first: async () => firstResult }),
          withIndex: () => ({ first: async () => firstResult })
        })
      }
    }
    expect(await captured(ctx, { value: 'foo' })).toBe(true)
    firstResult = { _id: 'org-1' }
    expect(await captured(ctx, { value: 'foo' })).toBe(false)
    expect(await captured(ctx, { exclude: 'org-1', value: 'foo' })).toBe(true)
  })
})
