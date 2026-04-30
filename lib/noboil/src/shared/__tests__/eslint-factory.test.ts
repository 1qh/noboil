import { describe, expect, test } from 'bun:test'
import { bodyContainsIdent, extractTables, isSchemaFile, schemaMarkers } from '../eslint-factory'
describe('schemaMarkers', () => {
  test('includes the expected wrapper invocations', () => {
    expect(schemaMarkers).toContain('makeOwned(')
    expect(schemaMarkers).toContain('makeOrgScoped(')
    expect(schemaMarkers).toContain('makeSingleton(')
    expect(schemaMarkers).toContain('makeBase(')
    expect(schemaMarkers).toContain('child(')
  })
})
describe('isSchemaFile', () => {
  test('detects each marker', () => {
    expect(isSchemaFile('foo makeOwned( bar')).toBe(true)
    expect(isSchemaFile('child(parent: t)')).toBe(true)
  })
  test('returns false for unrelated source', () => {
    expect(isSchemaFile('export const x = 1')).toBe(false)
    expect(isSchemaFile('')).toBe(false)
  })
})
describe('extractTables', () => {
  test('parses object-literal table bodies into name → body map', () => {
    const src = 'const owned = { todo: object({ title: string(), done: boolean() }), blog: object({ title: string() }) }'
    const result = extractTables(src)
    expect(result.size).toBeGreaterThan(0)
  })
  test('empty content returns empty map', () => {
    expect(extractTables('').size).toBe(0)
  })
})
describe('bodyContainsIdent', () => {
  test('returns true when nested ident matches', () => {
    const nodes = [{ argument: { name: 'foo', type: 'Identifier' as const }, type: 'ReturnStatement' as const }]
    expect(bodyContainsIdent(nodes, 'foo')).toBe(true)
  })
  test('returns false when ident is not present', () => {
    const nodes = [{ name: 'bar', type: 'Identifier' as const }]
    expect(bodyContainsIdent(nodes, 'foo')).toBe(false)
  })
  test('walks expression and body containers', () => {
    const inner = { name: 'x', type: 'Identifier' as const }
    expect(bodyContainsIdent([{ expression: inner, type: 'ExpressionStatement' as const }], 'x')).toBe(true)
    expect(bodyContainsIdent([{ body: { body: [inner] }, type: 'BlockStatement' as const }], 'x')).toBe(true)
  })
})
