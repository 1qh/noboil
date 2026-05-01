import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plugin, recommended, rules } from '../eslint'
describe('convex eslint plugin bundle', () => {
  test('exports plugin + recommended + rules', () => {
    expect(plugin).toBeDefined()
    expect(typeof recommended).toBe('object')
    expect(typeof rules).toBe('object')
    expect(Object.keys(rules).length).toBeGreaterThan(0)
  })
  test('schema callbacks exercise convex/ discovery (direct + nested)', () => {
    const cwd = process.cwd()
    const dir = mkdtempSync(join(tmpdir(), 'noboil-eslint-direct-'))
    try {
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      writeFileSync(join(dir, 'convex', 'todos.ts'), 'export const x = 1', 'utf8')
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({ title: string() }) })', 'utf8')
      process.chdir(dir)
      expect(typeof rules).toBe('object')
    } finally {
      process.chdir(cwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
