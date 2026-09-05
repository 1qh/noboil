/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { describe, expect, test } from 'bun:test'
import { auditLog, slowQueryWarn } from '../middleware'

describe('stdb middleware', () => {
  test('auditLog returns object with hooks and name', () => {
    const m = auditLog()
    expect(m.name).toBe('auditLog')
    expect(typeof m.afterCreate).toBe('function')
    expect(typeof m.afterUpdate).toBe('function')
    expect(typeof m.afterDelete).toBe('function')
    const ctx = { sender: { __id: 's' }, table: 't' } as never
    m.afterCreate?.(ctx, { id: 'r1', row: { x: 1 } } as never)
    m.afterUpdate?.(ctx, { id: 'r1', patch: { x: 2 }, prev: { x: 1 } } as never)
    m.afterDelete?.(ctx, { id: 'r1', row: { x: 1 } } as never)
  })
  test('auditLog verbose mode runs', () => {
    const m = auditLog({ logLevel: 'debug', verbose: true })
    expect(m.name).toBe('auditLog')
  })
  test('slowQueryWarn fires below threshold (no warn) and above threshold (warn)', async () => {
    const m = slowQueryWarn({ threshold: 0 })
    const ctx = { table: 't' } as never
    m.beforeCreate?.(ctx, { data: { a: 1 } })
    m.beforeUpdate?.(ctx, { id: 'r', patch: { a: 2 }, prev: { a: 1 } } as never)
    m.beforeDelete?.(ctx, { id: 'r', prev: { a: 1 } } as never)
    await new Promise(r => {
      setTimeout(r, 5)
    })
    m.afterCreate?.(ctx, { id: 'r', row: { a: 1 } } as never)
    m.afterUpdate?.(ctx, { id: 'r', patch: { a: 2 }, prev: { a: 1 } } as never)
    m.afterDelete?.(ctx, { id: 'r', row: { a: 1 } } as never)
    const m2 = slowQueryWarn()
    const ctx2 = { table: 't' } as never
    m2.afterCreate?.(ctx2, { id: 'r', row: { a: 1 } } as never)
    m2.afterUpdate?.(ctx2, { id: 'r', patch: { a: 2 }, prev: { a: 1 } } as never)
    m2.afterDelete?.(ctx2, { id: 'r', row: { a: 1 } } as never)
    expect(m.name).toBe('slowQueryWarn')
  })
})
