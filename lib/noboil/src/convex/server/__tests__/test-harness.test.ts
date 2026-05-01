/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: test env */
import { describe, expect, test } from 'bun:test'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestHarness } from '../test-harness'
describe('createTestHarness', () => {
  test('returns makeTest factory + envClear deletes vars', () => {
    process.env.NOBOIL_TEST_HARNESS_VAR = 'sentinel'
    const dir = mkdtempSync(join(tmpdir(), 'noboil-harness-'))
    try {
      const schema = defineSchema({ users: defineTable({ name: v.optional(v.string()) }) })
      const { makeTest } = createTestHarness({
        convexDir: dir,
        envClear: ['NOBOIL_TEST_HARNESS_VAR'],
        schema
      })
      expect(typeof makeTest).toBe('function')
      expect(process.env.NOBOIL_TEST_HARNESS_VAR).toBeUndefined()
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
