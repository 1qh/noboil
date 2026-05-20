/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: test env */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { isTestMode } from '../test'

describe('stdb server/test isTestMode', () => {
  const orig = process.env.SPACETIMEDB_TEST_MODE
  beforeAll(() => {
    process.env.SPACETIMEDB_TEST_MODE = 'true'
  })
  afterAll(() => {
    if (orig === undefined) delete process.env.SPACETIMEDB_TEST_MODE
    else process.env.SPACETIMEDB_TEST_MODE = orig
  })
  test('returns true when env var is "true"', () => {
    expect(isTestMode()).toBe(true)
  })
  test('returns false when env var unset', () => {
    delete process.env.SPACETIMEDB_TEST_MODE
    expect(isTestMode()).toBe(false)
    process.env.SPACETIMEDB_TEST_MODE = 'true'
  })
})
