import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  bodyContainsIdent,
  buildRules,
  extractTables,
  isSchemaFile,
  readSchemaContentFrom,
  schemaMarkers
} from '../eslint-factory'
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
describe('readSchemaContentFrom', () => {
  test('returns empty when dir does not exist', () => {
    expect(readSchemaContentFrom(join(tmpdir(), 'noboil-nonexistent-xyz-12345'))).toBe('')
  })
  test('finds schema file containing a marker', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-eslint-'))
    try {
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: 1 })', 'utf8')
      writeFileSync(join(dir, 'other.ts'), 'export const x = 1', 'utf8')
      expect(readSchemaContentFrom(dir)).toContain('makeOwned')
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('returns empty when no .ts contains a marker', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-eslint-'))
    try {
      writeFileSync(join(dir, 'a.ts'), 'export const x = 1', 'utf8')
      expect(readSchemaContentFrom(dir)).toBe('')
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
describe('buildRules', () => {
  test('returns rules object with expected rule names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-rules-'))
    mkdirSync(join(dir, 'convex'), { recursive: true })
    try {
      const rules = buildRules({
        apiCasing: { casingMismatchMsg: '', getApiBaseName: () => 'api', unknownModuleMsg: '' },
        bindings: { discoveryFailedMsg: '', discoveryMissingLabel: '' },
        cast: { isCastTarget: () => false, unsafeApiCastMsg: '' },
        connection: { dataFns: new Set(), missingConnectionMsg: '', unhandledFetchMsg: '' },
        crud: { factories: new Set(), writeFactories: new Set() },
        list: { hookName: 'useQuery', msg: '', propNames: new Set() },
        mutation: { authIdents: [], requireDbInBody: true },
        orgQuery: { isHook: () => false, msg: '' },
        pluginName: 'noboil-test',
        provider: { missingErrorBoundaryMsg: '', nameMatchers: ['Provider'] },
        schema: {
          findSchemaContent: () => '',
          findSchemaContentFresh: () => '',
          getModules: () => [],
          getModulesFresh: () => []
        }
      } as never)
      expect(typeof rules).toBe('object')
      expect(Object.keys(rules).length).toBeGreaterThan(0)
      for (const r of Object.values(rules)) {
        expect(typeof (r as { create: unknown }).create).toBe('function')
        expect(typeof (r as { meta: unknown }).meta).toBe('object')
      }
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('apiCasing rule reports unknown module', () => {
    const reports: { messageId: string }[] = []
    const rules = buildRules({
      apiCasing: {
        casingMismatchMsg: '',
        getApiBaseName: (n: { type: string }) => (n.type === 'Identifier' ? 'api' : undefined),
        unknownModuleMsg: ''
      },
      bindings: { discoveryFailedMsg: '', discoveryMissingLabel: '' },
      cast: { isCastTarget: () => false, unsafeApiCastMsg: '' },
      connection: { dataFns: new Set(), missingConnectionMsg: '', unhandledFetchMsg: '' },
      crud: { factories: new Set(), writeFactories: new Set() },
      list: { hookName: 'useQuery', msg: '', propNames: new Set() },
      mutation: { authIdents: [], requireDbInBody: true },
      orgQuery: { isHook: () => false, msg: '' },
      pluginName: 'p',
      provider: { missingErrorBoundaryMsg: '', nameMatchers: [] },
      schema: {
        findSchemaContent: () => '',
        findSchemaContentFresh: () => '',
        getModules: () => ['users', 'todos'],
        getModulesFresh: () => ['users', 'todos']
      }
    } as never) as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>
    const apiCasing = rules['api-casing']
    if (!apiCasing) throw new Error('expected api-casing rule')
    const visitor = apiCasing.create({
      cwd: '/tmp',
      filename: '/tmp/x.ts',
      report: (d: { messageId: string }) => reports.push(d)
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
    expect(reports.some(r => r.messageId === 'unknownModule')).toBe(true)
  })
})
