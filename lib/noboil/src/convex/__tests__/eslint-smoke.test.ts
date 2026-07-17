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
  test('schema callbacks exercise convex/ discovery (direct + nested)', async () => {
    const cwd = process.cwd()
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-eslint-direct-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'convex', 'todos.ts'), 'export const x = 1', 'utf8')
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({ title: string() }) })', 'utf8')
      process.chdir(dir)
      const mod = (await import(`../eslint?t=${Date.now()}`)) as { rules: unknown }
      expect(typeof mod.rules).toBe('object')
    } finally {
      process.chdir(cwd)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('schema callbacks find subdirectory convex/', async () => {
    const cwd = process.cwd()
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-eslint-sub-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'app', 'convex', '_generated'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'app', 'convex', 'todos.ts'), `export const x = crud('todo', schema)`, 'utf8')
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'app', 'schema.ts'),
        'const owned = makeOwned({ todo: object({ title: string() }) })',
        'utf8'
      )
      process.chdir(dir)
      const mod = (await import(`../eslint?ts=${Date.now()}`)) as { rules: unknown }
      expect(typeof mod.rules).toBe('object')
    } finally {
      process.chdir(cwd)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('discovery-check rule invokes findSchemaContent + getModules helpers', () => {
    const cwd = process.cwd()
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-eslint-disc-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'convex', 'todos.ts'), 'export const x = 1', 'utf8')
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({ title: string() }) })', 'utf8')
      process.chdir(dir)
      const dRule = (rules as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>)['discovery-check']
      if (!dRule) throw new Error('expected rule')
      const reports: { messageId: string }[] = []
      const visitor = dRule.create({
        cwd: dir,
        filename: join(dir, 'convex', 'todos.ts'),
        report: (d: { messageId: string }) => reports.push(d),
        sourceCode: { getAncestors: () => [] }
      }) as { Program?: (n: unknown) => void }
      if (visitor.Program) visitor.Program({ type: 'Program' })
      // Discovery succeeds (schema + modules both found), so the rule warns nothing.
      expect(reports).toHaveLength(0)
    } finally {
      process.chdir(cwd)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('api-casing rule invokes getModules + isApiExpression helpers', () => {
    const cwd = process.cwd()
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-eslint-api-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'convex', 'todos.ts'), 'export const x = 1', 'utf8')
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({}) })', 'utf8')
      process.chdir(dir)
      const apiRule = (rules as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>)['api-casing']
      if (!apiRule) throw new Error('expected rule')
      const reports: { data?: { used?: string }; messageId: string }[] = []
      const visitor = apiRule.create({
        cwd: dir,
        filename: join(dir, 'convex', 'todos.ts'),
        report: (d: { data?: { used?: string }; messageId: string }) => reports.push(d)
      }) as { MemberExpression: (n: unknown) => void }
      visitor.MemberExpression({
        object: {
          object: { name: 'api', type: 'Identifier' },
          property: { name: 'tasks', type: 'Identifier' },
          type: 'MemberExpression'
        },
        property: { name: 'create', type: 'Identifier' },
        type: 'MemberExpression'
      })
      // `tasks` has no file in convex/ (only todos.ts), so the rule flags it as an unknown module.
      expect(reports).toHaveLength(1)
      expect(reports[0]?.messageId).toBe('unknownModule')
      expect(reports[0]?.data?.used).toBe('tasks')
    } finally {
      process.chdir(cwd)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
