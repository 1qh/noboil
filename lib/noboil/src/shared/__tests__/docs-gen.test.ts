import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractJSDoc, extractSignature, processEntryPoint, resolveReExports } from '../docs-gen'

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
describe('processEntryPoint', () => {
  test('returns 0 when entry path missing', () => {
    const lines: string[] = []
    expect(processEntryPoint({ label: 'X', path: 'nope.ts' }, '/tmp', lines)).toBe(0)
  })
  test('returns 0 when index file has no re-exports', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-pep-'))
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'index.ts'), 'export const x = 1', 'utf8')
      const lines: string[] = []
      expect(processEntryPoint({ label: 'X', path: 'index.ts' }, dir, lines)).toBe(0)
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('emits markdown table rows for each re-export', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-pep-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'sub'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'sub', 'foo.ts'), '/** does foo */\nconst foo = (a: string) => a', 'utf8')
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'index.ts'), `export { foo } from './sub/foo'\n`, 'utf8')
      const lines: string[] = []
      expect(processEntryPoint({ label: 'noboil/x', path: 'index.ts' }, dir, lines)).toBe(1)
      expect(lines.join('\n')).toContain('## noboil/x')
      expect(lines.join('\n')).toContain('foo')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
