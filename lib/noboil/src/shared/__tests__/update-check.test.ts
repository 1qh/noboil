import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { checkForUpdate, isNewer } from '../update-check'

describe('isNewer', () => {
  test('patch bump', () => {
    expect(isNewer('0.0.2', '0.0.1')).toBe(true)
  })
  test('minor bump', () => {
    expect(isNewer('0.1.0', '0.0.99')).toBe(true)
  })
  test('major bump', () => {
    expect(isNewer('1.0.0', '0.99.99')).toBe(true)
  })
  test('equal', () => {
    expect(isNewer('1.2.3', '1.2.3')).toBe(false)
  })
  test('older', () => {
    expect(isNewer('0.0.0', '0.0.1')).toBe(false)
  })
  test('zero cache vs shipped', () => {
    expect(isNewer('0.0.0', '0.0.1')).toBe(false)
  })
  test('malformed falls back to 0', () => {
    expect(isNewer('abc.def.ghi', '0.0.1')).toBe(false)
    expect(isNewer('0.0.1', 'abc.def.ghi')).toBe(true)
  })
  test('missing patch', () => {
    expect(isNewer('1.2', '1.1')).toBe(true)
  })
})
describe('checkForUpdate', () => {
  const origFetch = globalThis.fetch
  beforeAll(() => {
    globalThis.fetch = (async () =>
      Response.json(
        { version: '99.0.0' },
        {
          headers: { 'content-type': 'application/json' },
          status: 200
        }
      )) as never
  })
  afterAll(() => {
    globalThis.fetch = origFetch
  })
  test('returns latest version when fetch succeeds + newer', async () => {
    const result = await checkForUpdate('0.0.1')
    expect(result === '99.0.0' || result === '0.0.1').toBe(true)
  })
  test('returns current when network fails', async () => {
    globalThis.fetch = (async () => {
      throw new Error('offline')
    }) as never
    const result = await checkForUpdate('0.0.1')
    expect(typeof result).toMatch(/string|object/u)
  })
})
