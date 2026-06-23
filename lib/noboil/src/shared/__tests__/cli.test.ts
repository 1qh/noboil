import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  camelToTitle,
  hasFlag,
  parseEnumFieldDef,
  readArgOrEqFlag,
  readEqFlag,
  writeFilesToDir,
  writeIfNotExists
} from '../cli'

describe('camelToTitle', () => {
  test('lowercase first letter is upcased', () => {
    expect(camelToTitle('hello')).toBe('Hello')
  })
  test('camelCase splits on capitals', () => {
    expect(camelToTitle('siteConfig')).toBe('Site Config')
  })
  test('multiple capitals split', () => {
    expect(camelToTitle('myAwesomeFn')).toBe('My Awesome Fn')
  })
})
describe('parseEnumFieldDef', () => {
  const types = new Set(['boolean', 'number', 'string'])
  test('plain field', () => {
    expect(parseEnumFieldDef('title:string', types)).toEqual({ name: 'title', optional: false, type: 'string' })
  })
  test('optional with ?', () => {
    expect(parseEnumFieldDef('bio:string?', types)).toEqual({ name: 'bio', optional: true, type: 'string' })
  })
  test('enum value', () => {
    expect(parseEnumFieldDef('status:enum(draft,published)', types)).toEqual({
      name: 'status',
      optional: false,
      type: { enum: ['draft', 'published'] }
    })
  })
  test('optional enum', () => {
    expect(parseEnumFieldDef('priority:enum(low,high)?', types)).toEqual({
      name: 'priority',
      optional: true,
      type: { enum: ['low', 'high'] }
    })
  })
  test('rejects bad shape', () => {
    expect(parseEnumFieldDef('justname', types)).toBeNull()
    expect(parseEnumFieldDef('a:b:c', types)).toBeNull()
  })
  test('rejects unknown type', () => {
    expect(parseEnumFieldDef('x:notAType', types)).toBeNull()
  })
})
describe('hasFlag', () => {
  test('matches any provided alias', () => {
    expect(hasFlag(['--verbose'], '--verbose', '-v')).toBe(true)
    expect(hasFlag(['-v'], '--verbose', '-v')).toBe(true)
  })
  test('false when absent', () => {
    expect(hasFlag(['--other'], '--verbose')).toBe(false)
  })
})
describe('readEqFlag', () => {
  test('reads --name=value', () => {
    expect(readEqFlag(['--db=convex'], 'db', 'def')).toBe('convex')
  })
  test('returns fallback when missing', () => {
    expect(readEqFlag([], 'db', 'def')).toBe('def')
  })
})
describe('readArgOrEqFlag', () => {
  test('eq form', () => {
    expect(readArgOrEqFlag(['--name=foo'], 'name', 'd')).toBe('foo')
  })
  test('space form', () => {
    expect(readArgOrEqFlag(['--name', 'foo'], 'name', 'd')).toBe('foo')
  })
  test('fallback', () => {
    expect(readArgOrEqFlag([], 'name', 'd')).toBe('d')
  })
  test('flag at end with no value falls back', () => {
    expect(readArgOrEqFlag(['--name'], 'name', 'd')).toBe('d')
  })
})
describe('writeIfNotExists / writeFilesToDir', () => {
  test('writes new file', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-cli-'))
    try {
      const path = join(dir, 'sub/foo.ts')
      const wrote = writeIfNotExists({ content: 'hello', label: 'foo.ts', path })
      expect(wrote).toBe(true)
      // oxlint-disable-next-line node/no-sync
      expect(existsSync(path)).toBe(true)
      // oxlint-disable-next-line node/no-sync
      expect(readFileSync(path, 'utf8')).toBe('hello')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('skips existing file', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-cli-'))
    try {
      const path = join(dir, 'foo.ts')
      writeIfNotExists({ content: 'first', label: 'foo.ts', path })
      const wrote = writeIfNotExists({ content: 'second', label: 'foo.ts', path })
      expect(wrote).toBe(false)
      // oxlint-disable-next-line node/no-sync
      expect(readFileSync(path, 'utf8')).toBe('first')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('writeFilesToDir reports created/skipped', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-cli-'))
    try {
      const r1 = writeFilesToDir({
        baseDir: dir,
        files: [
          ['a.ts', 'A'],
          ['b.ts', 'B']
        ],
        label: 'tpl'
      })
      expect(r1).toEqual({ created: 2, skipped: 0 })
      const r2 = writeFilesToDir({
        baseDir: dir,
        files: [
          ['a.ts', 'A'],
          ['c.ts', 'C']
        ],
        label: 'tpl'
      })
      expect(r2).toEqual({ created: 1, skipped: 1 })
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
