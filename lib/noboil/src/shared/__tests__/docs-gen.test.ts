import { describe, expect, test } from 'bun:test'
import { extractJSDoc, extractSignature, resolveReExports } from '../docs-gen'
describe('resolveReExports', () => {
  test('parses named, type, default re-exports', () => {
    const src = [
      `export { foo } from './foo'`,
      `export type { Bar } from './bar'`,
      `export { default as Baz } from './baz'`
    ].join('\n')
    const out = resolveReExports(src)
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ isDefault: false, isType: false, sourcePath: './foo', symbol: 'foo' })
    expect(out[1]?.isType).toBe(true)
    expect(out[2]?.isDefault).toBe(true)
    expect(out[2]?.symbol).toBe('Baz')
  })
  test('returns empty for non-matching content', () => {
    expect(resolveReExports('const x = 1')).toEqual([])
  })
})
describe('extractJSDoc', () => {
  test('finds JSDoc for const', () => {
    const src = '/** does a thing */\nconst foo = 1'
    expect(extractJSDoc(src, 'foo')).toBe('does a thing')
  })
  test('finds JSDoc for interface and type', () => {
    expect(extractJSDoc('/** an iface */\ninterface F {}', 'F')).toBe('an iface')
    expect(extractJSDoc('/** a type */\ntype T = string', 'T')).toBe('a type')
  })
  test('returns empty string when missing', () => {
    expect(extractJSDoc('const foo = 1', 'foo')).toBe('')
  })
})
describe('extractSignature', () => {
  test('extracts arrow function params', () => {
    expect(extractSignature('const fn = (a: number, b: string) => 1', 'fn')).toBe('(a: number, b: string) => ...')
  })
  test('returns explicit annotation when present', () => {
    expect(extractSignature('const x: MyType = 1', 'x')).toBe('MyType')
  })
  test('summarizes interface keys', () => {
    expect(extractSignature('interface User {\n  id: string\n  name: string\n}', 'User')).toBe('{ id, name }')
  })
  test('returns empty for unknown symbol', () => {
    expect(extractSignature('const a = 1', 'missing')).toBe('')
  })
})
