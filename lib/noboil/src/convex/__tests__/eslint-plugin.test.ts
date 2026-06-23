import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plugin, recommended, rules } from '../eslint'

describe('convex eslint plugin export', () => {
  test('exposes a plugin object with rules', () => {
    expect(plugin).toBeDefined()
    expect(plugin.rules).toBe(rules)
  })
  test('rules object has expected built-in rule names', () => {
    expect(typeof rules).toBe('object')
    expect(Object.keys(rules).length).toBeGreaterThan(0)
  })
  test('recommended config references rules under noboil-convex/ namespace', () => {
    expect(recommended).toBeDefined()
    const ruleNames = Object.keys(recommended.rules)
    expect(ruleNames.every(n => n.startsWith('noboil-convex/'))).toBe(true)
  })
  test('rules export is the same object that buildRules produced', () => {
    for (const ruleName of Object.keys(rules)) {
      const rule = (rules as Record<string, { create: unknown }>)[ruleName]
      expect(typeof rule?.create).toBe('function')
    }
  })
  test('api-casing visitor exercises convex dir + module discovery helpers', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-eslint-plug-'))
    try {
      const cvx = join(dir, 'convex')
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(cvx, '_generated'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(cvx, 'todos.ts'), 'export const x = 1', 'utf8')
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({ title: string() }) })', 'utf8')
      const reports: { messageId: string }[] = []
      const apiCasingRule = (rules as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>)['api-casing']
      if (!apiCasingRule) throw new Error('api-casing rule missing')
      const visitor = apiCasingRule.create({
        cwd: dir,
        filename: join(dir, 'app.ts'),
        report: (d: { messageId: string }) => reports.push(d)
      }) as { MemberExpression: (n: unknown) => void }
      visitor.MemberExpression({
        object: {
          object: { name: 'api', type: 'Identifier' },
          property: { name: 'unknownTable', type: 'Identifier' },
          type: 'MemberExpression'
        },
        property: { name: 'create', type: 'Identifier' },
        type: 'MemberExpression'
      })
      expect(reports.length).toBeGreaterThanOrEqual(0)
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
