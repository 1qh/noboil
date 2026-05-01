import { describe, expect, test } from 'bun:test'
import { idFromWire, idToWire, isErrorCode, isMutationError, ownGet, readCtx } from '../helpers'
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
})
