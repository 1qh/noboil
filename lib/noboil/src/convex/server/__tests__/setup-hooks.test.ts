import { describe, expect, test } from 'bun:test'
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
  })
  test('setup without hooks still produces builders', () => {
    const wired = setup(cfg) as Record<string, unknown>
    for (const name of ['m', 'q', 'pq', 'cm', 'cq']) expect(wired[name]).toBeDefined()
  })
})
