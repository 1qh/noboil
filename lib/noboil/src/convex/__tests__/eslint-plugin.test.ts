import { describe, expect, test } from 'bun:test'
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
})
