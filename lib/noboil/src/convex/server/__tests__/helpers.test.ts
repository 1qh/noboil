import { describe, expect, test } from 'bun:test'
import { addUrls, normalizeRateLimit } from '../helpers'
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
    const storage = { getUrl: async (id: string) => `http://example/${id}` } as never
    const out = (await addUrls({
      doc: { avatar: 'storage-1', missing: null, title: 't' },
      fileFields: ['avatar', 'missing'],
      storage
    })) as { avatarUrl?: string; missingUrl?: string }
    expect(out.avatarUrl).toBe('http://example/storage-1')
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
