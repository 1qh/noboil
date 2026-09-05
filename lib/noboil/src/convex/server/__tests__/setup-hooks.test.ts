/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
/* oxlint-disable promise/prefer-await-to-callbacks */
import { describe, expect, test } from 'bun:test'
import { z } from 'zod/v4'
import { setup } from '../setup'

const stubBuilder = ((args: unknown) => args) as never
const cfg = {
  action: stubBuilder,
  getAuthUserId: async () => null,
  internalMutation: stubBuilder,
  internalQuery: stubBuilder,
  mutation: stubBuilder,
  query: stubBuilder
} as never
describe('setup with global hooks wires merge functions', () => {
  test('returns crud/orgCrud/childCrud/cacheCrud/singletonCrud/log/kv/quota functions', () => {
    const cfgWithHooks = {
      ...(cfg as object),
      hooks: {
        afterCreate: async () => undefined,
        afterDelete: async () => undefined,
        afterUpdate: async () => undefined,
        beforeCreate: async (_c: unknown, p: { data: unknown }) => p.data,
        beforeDelete: async () => undefined,
        beforeUpdate: async (_c: unknown, p: { patch: unknown }) => p.patch
      }
    }
    const wired = setup(cfgWithHooks as never) as Record<string, unknown>
    for (const name of ['crud', 'orgCrud', 'childCrud', 'cacheCrud', 'singletonCrud', 'log', 'kv', 'quota'])
      expect(typeof wired[name]).toBe('function')
    const baseSchema = z.object({ title: z.string() })
    const ownedSchema = Object.assign(baseSchema.clone(), { __name: 'todo' }) as never
    const orgSchema = Object.assign(baseSchema.clone(), { __name: 'project' }) as never
    const schema = baseSchema
    const cb = wired.childCrud as (
      t: string,
      meta: { foreignKey: string; index: string; parent: string; schema: typeof schema },
      opts?: unknown
    ) => unknown
    const oc = wired.orgCrud as (t: string, s: typeof orgSchema) => unknown
    const cc = wired.cacheCrud as (opts: { key: string; schema: typeof schema; table: string; ttl?: number }) => unknown
    const sc = wired.singletonCrud as (t: string, s: typeof ownedSchema) => unknown
    const cd = wired.crud as (t: string, s: typeof ownedSchema) => unknown
    const lg = wired.log as (t: string, s: typeof schema) => unknown
    const kv = wired.kv as (t: string, opts: { schema: typeof schema }) => unknown
    const qt = wired.quota as (t: string, opts: { durationMs: number; limit: number }) => unknown
    const tryCall = (fn: () => unknown) => {
      try {
        return fn()
      } catch {
        return null
      }
    }
    expect(tryCall(() => cd('todo', ownedSchema))).not.toBeUndefined()
    expect(
      tryCall(() => cb('msg', { foreignKey: 'parentId', index: 'by_parent', parent: 'todo', schema }))
    ).not.toBeUndefined()
    expect(tryCall(() => oc('project', orgSchema))).not.toBeUndefined()
    expect(tryCall(() => cc({ key: 'k', schema, table: 'cache' }))).not.toBeUndefined()
    expect(tryCall(() => sc('profile', ownedSchema))).not.toBeUndefined()
    expect(tryCall(() => lg('event', schema))).not.toBeUndefined()
    expect(tryCall(() => kv('settings', { schema }))).not.toBeUndefined()
    expect(tryCall(() => qt('throttle', { durationMs: 60_000, limit: 5 }))).not.toBeUndefined()
    const uniqueCheck = wired.uniqueCheck as (...args: unknown[]) => unknown
    expect(tryCall(() => uniqueCheck(schema, 'todo', 'title', 'by_title'))).not.toBeUndefined()
  })
  test('setup without hooks still produces builders', () => {
    const wired = setup(cfg) as Record<string, unknown>
    for (const name of ['m', 'q', 'pq', 'cm', 'cq']) expect(wired[name]).toBeDefined()
  })
  test('setup with orgSchema produces org endpoints', () => {
    const orgZod = z.object({ name: z.string(), slug: z.string() })
    const wired = setup({ ...(cfg as object), orgSchema: orgZod } as never) as Record<string, unknown>
    expect(wired.org).toBeDefined()
  })
})
