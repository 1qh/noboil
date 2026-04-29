/* eslint-disable no-console */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { auditLog, composeMiddleware, inputSanitize, slowQueryWarn } from '../middleware'
const lines: { fn: string; raw: string }[] = []
const realConsole = { debug: console.debug, info: console.info, warn: console.warn }
beforeEach(() => {
  lines.length = 0
  console.debug = mock((s: string) => lines.push({ fn: 'debug', raw: s })) as never
  console.info = mock((s: string) => lines.push({ fn: 'info', raw: s })) as never
  console.warn = mock((s: string) => lines.push({ fn: 'warn', raw: s })) as never
})
afterEach(() => {
  Object.assign(console, realConsole)
})
const ctx = (op: 'create' | 'delete' | 'update' = 'create', extras: Record<string, unknown> = {}) =>
  ({ db: {}, operation: op, storage: {}, table: 'todo', userId: 'u1', ...extras }) as never
describe('auditLog middleware', () => {
  test('logs create with table + userId at info level by default', () => {
    auditLog().afterCreate?.(ctx('create'), { data: { title: 'hi' }, id: 'x1' })
    expect(lines).toHaveLength(1)
    expect(lines[0]?.fn).toBe('info')
    expect(lines[0]?.raw).toContain('"msg":"audit:create"')
    expect(lines[0]?.raw).toContain('"id":"x1"')
    expect(lines[0]?.raw).toContain('"table":"todo"')
    expect(lines[0]?.raw).not.toContain('"data"')
  })
  test('verbose=true includes row data', () => {
    auditLog({ verbose: true }).afterCreate?.(ctx('create'), { data: { title: 'x' }, id: 'i' })
    expect(lines[0]?.raw).toContain('"title":"x"')
  })
  test('logs update at debug level when configured + lists patched field names when verbose', () => {
    auditLog({ logLevel: 'debug', verbose: true }).afterUpdate?.(ctx('update'), {
      id: 'i',
      patch: { done: true, title: 'x' }
    } as never)
    expect(lines[0]?.fn).toBe('debug')
    expect(lines[0]?.raw).toContain('"fields":["done","title"]')
  })
  test('logs delete', () => {
    auditLog().afterDelete?.(ctx('delete'), { id: 'i' } as never)
    expect(lines[0]?.raw).toContain('"msg":"audit:delete"')
  })
})
describe('slowQueryWarn middleware', () => {
  test('emits warn when create exceeds threshold', () => {
    const mw = slowQueryWarn({ threshold: 1 })
    const c = ctx('create')
    mw.beforeCreate?.(c, { data: {} })
    ;(c as unknown as { _mwStart: number })._mwStart = Date.now() - 100
    mw.afterCreate?.(c, { data: {}, id: 'x' })
    expect(lines[0]?.fn).toBe('warn')
    expect(lines[0]?.raw).toContain('"msg":"slow:create"')
  })
  test('does not emit when under threshold', () => {
    const mw = slowQueryWarn({ threshold: 60_000 })
    const c = ctx('create')
    mw.beforeCreate?.(c, { data: {} })
    mw.afterCreate?.(c, { data: {}, id: 'x' })
    expect(lines).toHaveLength(0)
  })
  test('update + delete paths emit too', () => {
    const mw = slowQueryWarn({ threshold: 1 })
    const cu = ctx('update')
    mw.beforeUpdate?.(cu, { patch: { x: 1 } } as never)
    ;(cu as unknown as { _mwStart: number })._mwStart = Date.now() - 100
    mw.afterUpdate?.(cu, { id: 'i', patch: {} } as never)
    const cd = ctx('delete')
    mw.beforeDelete?.(cd, { id: 'i' } as never)
    ;(cd as unknown as { _mwStart: number })._mwStart = Date.now() - 100
    mw.afterDelete?.(cd, { id: 'i' } as never)
    expect(lines.some(l => l.raw.includes('"msg":"slow:update"'))).toBe(true)
    expect(lines.some(l => l.raw.includes('"msg":"slow:delete"'))).toBe(true)
  })
})
describe('composeMiddleware', () => {
  test('runs every middleware in order on each phase', async () => {
    const order: string[] = []
    const m1 = {
      afterCreate: () => {
        order.push('m1-after')
      },
      beforeCreate: ((_ctx: unknown, { data }: { data: Record<string, unknown> }) => {
        order.push('m1-before')
        return data
      }) as never,
      name: 'm1'
    }
    const m2 = {
      afterCreate: () => {
        order.push('m2-after')
      },
      beforeCreate: ((_ctx: unknown, { data }: { data: Record<string, unknown> }) => {
        order.push('m2-before')
        return data
      }) as never,
      name: 'm2'
    }
    const composed = composeMiddleware(m1, m2)
    await composed.beforeCreate?.(ctx('create'), { data: {} })
    await composed.afterCreate?.(ctx('create'), { data: {}, id: 'i' })
    expect(order).toEqual(['m1-before', 'm2-before', 'm1-after', 'm2-after'])
  })
})
describe('inputSanitize', () => {
  test('returns a Middleware', () => {
    const mw = inputSanitize()
    expect(mw.name).toBe('inputSanitize')
    expect(typeof mw.beforeCreate).toBe('function')
  })
})
