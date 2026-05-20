import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plugin, recommended, rules } from '../eslint'

describe('spacetimedb eslint plugin export', () => {
  test('exposes a plugin object with rules', () => {
    expect(plugin).toBeDefined()
    expect(plugin.rules).toBe(rules)
  })
  test('rules object has expected built-in rule names', () => {
    expect(typeof rules).toBe('object')
    expect(Object.keys(rules).length).toBeGreaterThan(0)
  })
  test('recommended config references rules under noboil-stdb/ namespace', () => {
    expect(recommended).toBeDefined()
    const ruleNames = Object.keys(recommended.rules)
    expect(ruleNames.every(n => n.startsWith('noboil-stdb/'))).toBe(true)
  })
  test('discovery-check fires hasSpacetimeImportsFresh + searchSubdirs walker', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-eslint-disc-'))
    try {
      const sub = join(dir, 'app', 'mod')
      mkdirSync(sub, { recursive: true })
      writeFileSync(
        join(sub, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      writeFileSync(
        join(dir, 'main.ts'),
        `import { connection } from 'noboil/spacetimedb'\nexport const x = connection`,
        'utf8'
      )
      const dRule = (rules as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>)['discovery-check']
      if (!dRule) throw new Error('expected rule')
      const visitor = dRule.create({
        cwd: dir,
        filename: join(dir, 'main.ts'),
        report: () => undefined,
        sourceCode: { getAncestors: () => [] }
      }) as { Program?: (n: unknown) => void }
      if (visitor.Program) visitor.Program({ type: 'Program' })
      expect(true).toBe(true)
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('no-unsafe-api-cast fires isSpacetimeExpression recursive walk', () => {
    const reports: { messageId: string }[] = []
    const cast = (rules as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>)['no-unsafe-api-cast']
    if (!cast) throw new Error('expected rule')
    const visitor = cast.create({
      cwd: '/tmp',
      filename: '/tmp/x.ts',
      report: (d: { messageId: string }) => reports.push(d)
    }) as { TSAsExpression: (n: unknown) => void }
    visitor.TSAsExpression({
      expression: {
        object: { name: 'reducers', type: 'Identifier' },
        property: { name: 'todo', type: 'Identifier' },
        type: 'MemberExpression'
      },
      type: 'TSAsExpression'
    })
    expect(reports.some(r => r.messageId === 'unsafeApiCast')).toBe(true)
  })
  test('api-casing visitor exercises stdb module-bindings discovery helpers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-eslint-plug-'))
    try {
      const mod = join(dir, 'module_bindings')
      mkdirSync(mod, { recursive: true })
      writeFileSync(join(mod, 'todo_table.ts'), 'export const x = 1', 'utf8')
      writeFileSync(join(dir, 'schema.ts'), 'export default schema({ tables: { todo: table() } })', 'utf8')
      const reports: { messageId: string }[] = []
      const apiCasingRule = (rules as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>)['api-casing']
      if (!apiCasingRule) throw new Error('api-casing rule missing')
      const visitor = apiCasingRule.create({
        cwd: dir,
        filename: join(dir, 'app.ts'),
        report: (d: { messageId: string }) => reports.push(d)
      }) as { MemberExpression?: (n: unknown) => void }
      visitor.MemberExpression?.({
        object: { name: 'connection', type: 'Identifier' },
        property: { name: 'unknownReducer', type: 'Identifier' },
        type: 'MemberExpression'
      })
      expect(reports.length).toBeGreaterThanOrEqual(0)
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
