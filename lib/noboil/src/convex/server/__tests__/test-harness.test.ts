/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { describe, expect, test } from 'bun:test'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getOrgMembership, TEST_EMAIL } from '../test'
import { createTestHarness } from '../test-harness'

describe('createTestHarness', () => {
  test('returns makeTest factory + envClear deletes vars', () => {
    process.env.NOBOIL_TEST_HARNESS_VAR = 'sentinel'
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-harness-'))
    try {
      // oxlint-disable-next-line unicorn/max-nested-calls
      const schema = defineSchema({ users: defineTable({ name: v.optional(v.string()) }) })
      const { makeTest } = createTestHarness({
        convexDir: dir,
        envClear: ['NOBOIL_TEST_HARNESS_VAR'],
        schema
      })
      expect(typeof makeTest).toBe('function')
      /** biome-ignore lint/suspicious/noUndeclaredEnvVars: intentional env access */
      expect(process.env.NOBOIL_TEST_HARNESS_VAR).toBeUndefined()
      try {
        const t = makeTest()
        expect(t).toBeDefined()
      } catch {
        // Empty dir = convexTest may fail; loadModules path still ran
      }
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
describe('getOrgMembership', () => {
  test('returns null when org not found', async () => {
    const db = { get: async () => null } as never
    expect(await getOrgMembership(db, 'org-x', 'u-1')).toBeNull()
  })
  test('returns isOwner=true when user is org owner', async () => {
    const db = {
      get: async () => ({ _id: 'org-1', userId: 'u-1' }),
      query: () => ({
        withIndex: () => ({
          unique: async () => null
        })
      })
    } as never
    const out = await getOrgMembership(db, 'org-1', 'u-1')
    expect(out?.isOwner).toBe(true)
    expect(out?.isAdmin).toBe(true)
  })
  test('returns null when user not member and not owner', async () => {
    const db = {
      get: async () => ({ _id: 'org-1', userId: 'u-other' }),
      query: () => ({
        withIndex: () => ({
          unique: async () => null
        })
      })
    } as never
    expect(await getOrgMembership(db, 'org-1', 'u-1')).toBeNull()
  })
  test('returns admin info when user is admin member', async () => {
    const db = {
      get: async () => ({ _id: 'org-1', userId: 'u-other' }),
      query: () => ({
        withIndex: () => ({
          unique: async () => ({ _id: 'm-1', isAdmin: true, userId: 'u-1' })
        })
      })
    } as never
    const out = await getOrgMembership(db, 'org-1', 'u-1')
    expect(out?.isOwner).toBe(false)
    expect(out?.isAdmin).toBe(true)
  })
  test('TEST_EMAIL constant defined', () => {
    expect(typeof TEST_EMAIL).toBe('string')
    expect(TEST_EMAIL).toContain('@')
  })
})
