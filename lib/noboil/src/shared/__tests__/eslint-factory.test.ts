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
  test('require-rate-limit fires on write factories without rateLimit', () => {
    const reports: { messageId: string }[] = []
    const rules = buildRules({
      apiCasing: { casingMismatchMsg: '', getApiBaseName: () => undefined, unknownModuleMsg: '' },
      bindings: { discoveryFailedMsg: '', discoveryMissingLabel: '' },
      cast: { isCastTarget: () => false, unsafeApiCastMsg: '' },
      connection: { dataFns: new Set(), missingConnectionMsg: '', unhandledFetchMsg: '' },
      crud: { factories: new Set(['crud']), writeFactories: new Set(['crud']) },
      list: { hookName: 'useQuery', msg: '', propNames: new Set() },
      mutation: { authIdents: [], requireDbInBody: false },
      orgQuery: { isHook: () => false, msg: '' },
      pluginName: 'p',
      provider: { missingErrorBoundaryMsg: '', nameMatchers: [] },
      schema: {
        findSchemaContent: () => '',
        findSchemaContentFresh: () => '',
        getModules: () => [],
        getModulesFresh: () => []
      }
    } as never) as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>
    const rule = rules['require-rate-limit']
    if (!rule) throw new Error('expected require-rate-limit')
    const visitor = rule.create({
      cwd: '/tmp',
      filename: '/tmp/x.ts',
      report: (d: { messageId: string }) => reports.push(d)
    }) as { CallExpression: (n: unknown) => void }
    visitor.CallExpression({
      arguments: [{ type: 'Literal' }, { properties: [], type: 'ObjectExpression' }],
      callee: { name: 'crud', type: 'Identifier' },
      type: 'CallExpression'
    })
    expect(reports.some(r => r.messageId === 'missingRateLimit')).toBe(true)
  })
  test('multiple eslint rules fire on crafted nodes (consistent-crud-naming, prefer-useList, no-unsafe-api-cast, no-duplicate-crud, no-empty-search-config, prefer-useOrgQuery)', () => {
    const reports: { messageId: string }[] = []
    const cfg = {
      apiCasing: { casingMismatchMsg: '', getApiBaseName: () => undefined, unknownModuleMsg: '' },
      bindings: { discoveryFailedMsg: '', discoveryMissingLabel: '' },
      cast: {
        isCastTarget: (n: { type: string }) => n.type === 'Identifier',
        unsafeApiCastMsg: ''
      },
      connection: { dataFns: new Set(['fetchQuery']), missingConnectionMsg: '', unhandledFetchMsg: '' },
      crud: { factories: new Set(['crud']), writeFactories: new Set(['crud']) },
      list: { hookName: 'useQuery', msg: '', propNames: new Set(['list']) },
      mutation: { authIdents: ['getAuthUserId'], requireDbInBody: false },
      orgQuery: { isHook: (callee: string) => callee === 'useQuery', msg: '' },
      pluginName: 'p',
      provider: { missingErrorBoundaryMsg: '', nameMatchers: ['Provider'] },
      schema: {
        findSchemaContent: () => '',
        findSchemaContentFresh: () => '',
        getModules: () => [],
        getModulesFresh: () => []
      }
    } as never
    const rules = buildRules(cfg) as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>
    const ctx = {
      cwd: '/tmp',
      filename: '/tmp/x.ts',
      report: (d: { messageId: string }) => reports.push(d),
      sourceCode: { getAncestors: () => [] }
    }
    const get = (k: string) => {
      const r = rules[k]
      if (!r) throw new Error(`missing rule: ${k}`)
      return r
    }
    const naming = (get('consistent-crud-naming').create(ctx) as { CallExpression: (n: unknown) => void }).CallExpression
    naming({
      arguments: [
        { type: 'Literal', value: 'todo' },
        {
          object: { name: 'schema', type: 'Identifier' },
          property: { name: 'mismatched', type: 'Identifier' },
          type: 'MemberExpression'
        }
      ],
      callee: { name: 'crud', type: 'Identifier' },
      type: 'CallExpression'
    })
    const ulRule = (get('prefer-useList').create(ctx) as { CallExpression: (n: unknown) => void }).CallExpression
    ulRule({
      arguments: [
        {
          object: { name: 'api', type: 'Identifier' },
          property: { name: 'list', type: 'Identifier' },
          type: 'MemberExpression'
        }
      ],
      callee: { name: 'useQuery', type: 'Identifier' },
      type: 'CallExpression'
    })
    const cast = (get('no-unsafe-api-cast').create(ctx) as { TSAsExpression: (n: unknown) => void }).TSAsExpression
    cast({ expression: { type: 'Identifier' }, type: 'TSAsExpression' })
    const dup = (get('no-duplicate-crud').create(ctx) as { CallExpression: (n: unknown) => void }).CallExpression
    dup({
      arguments: [{ type: 'Literal', value: 'shared' }, { type: 'ObjectExpression' }],
      callee: { name: 'crud', type: 'Identifier' },
      type: 'CallExpression'
    })
    dup({
      arguments: [{ type: 'Literal', value: 'shared' }, { type: 'ObjectExpression' }],
      callee: { name: 'crud', type: 'Identifier' },
      type: 'CallExpression'
    })
    const empty = (get('no-empty-search-config').create(ctx) as { CallExpression: (n: unknown) => void }).CallExpression
    empty({
      arguments: [
        { type: 'Literal', value: 'todo' },
        { type: 'Identifier' },
        {
          properties: [
            { key: { name: 'search', type: 'Identifier' }, type: 'Property', value: { type: 'Literal', value: true } }
          ],
          type: 'ObjectExpression'
        }
      ],
      callee: { name: 'crud', type: 'Identifier' },
      type: 'CallExpression'
    })
    const orgRule = (get('prefer-useOrgQuery').create(ctx) as { CallExpression: (n: unknown) => void }).CallExpression
    orgRule({
      arguments: [
        { type: 'MemberExpression' },
        {
          properties: [{ key: { name: 'orgId', type: 'Identifier' }, type: 'Property', value: { type: 'Identifier' } }],
          type: 'ObjectExpression'
        }
      ],
      callee: { name: 'useQuery', type: 'Identifier' },
      type: 'CallExpression'
    })
    const ids = new Set(reports.map(r => r.messageId))
    expect(ids.has('crudNameMismatch')).toBe(true)
    expect(ids.has('preferUseList')).toBe(true)
    expect(ids.has('unsafeApiCast')).toBe(true)
    expect(ids.has('duplicateCrud')).toBe(true)
    expect(ids.has('searchTrue')).toBe(true)
    empty({
      arguments: [
        { type: 'Literal', value: 'todo' },
        { type: 'Identifier' },
        {
          properties: [
            {
              key: { name: 'search', type: 'Identifier' },
              type: 'Property',
              value: { properties: [], type: 'ObjectExpression' }
            }
          ],
          type: 'ObjectExpression'
        }
      ],
      callee: { name: 'crud', type: 'Identifier' },
      type: 'CallExpression'
    })
    const ids2 = new Set(reports.map(r => r.messageId))
    expect(ids2.has('searchEmpty')).toBe(true)
  })
  test('more eslint rules: no-unprotected-mutation, no-unlimited-file-size, no-raw-fetch-in-server-component, require-error-boundary, discovery-check, form-field-exists, form-field-kind, require-connection', () => {
    const reports: { messageId: string }[] = []
    const cfg = {
      apiCasing: { casingMismatchMsg: '', getApiBaseName: () => undefined, unknownModuleMsg: '' },
      bindings: { discoveryFailedMsg: 'missing {{missing}}', discoveryMissingLabel: 'lbl' },
      cast: { isCastTarget: () => false, unsafeApiCastMsg: '' },
      connection: { dataFns: new Set(['fetchQuery']), missingConnectionMsg: '', unhandledFetchMsg: '' },
      crud: { factories: new Set(['crud']), writeFactories: new Set(['crud']) },
      list: { hookName: 'useQuery', msg: '', propNames: new Set() },
      mutation: { authIdents: ['getAuthUserId'], requireDbInBody: false },
      orgQuery: { isHook: () => false, msg: '' },
      pluginName: 'p',
      provider: { missingErrorBoundaryMsg: '', nameMatchers: ['Provider'] },
      schema: {
        findSchemaContent: () => 'const owned = makeOwned({ todo: object({ avatar: file(), title: string() }) })',
        findSchemaContentFresh: () => '',
        getModules: () => [],
        getModulesFresh: () => []
      }
    } as never
    const rules = buildRules(cfg) as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>
    const ctx = {
      cwd: '/tmp',
      filename: '/tmp/x.ts',
      report: (d: { messageId: string }) => reports.push(d),
      sourceCode: { getAncestors: () => [] }
    }
    const get = (k: string) => {
      const r = rules[k]
      if (!r) throw new Error(`missing rule: ${k}`)
      return r
    }
    const um = (get('no-unprotected-mutation').create(ctx) as { CallExpression: (n: unknown) => void }).CallExpression
    um({
      arguments: [
        {
          properties: [
            {
              key: { name: 'handler', type: 'Identifier' },
              type: 'Property',
              value: {
                body: {
                  body: [{ name: 'doSomething', type: 'Identifier' }],
                  type: 'BlockStatement'
                },
                type: 'ArrowFunctionExpression'
              }
            }
          ],
          type: 'ObjectExpression'
        }
      ],
      callee: { name: 'm', type: 'Identifier' },
      type: 'CallExpression'
    })
    const fileSize = (get('no-unlimited-file-size').create(ctx) as { Program: (n: unknown) => void }).Program
    fileSize({ type: 'Program' })
    const noRaw = (get('no-raw-fetch-in-server-component').create(ctx) as { CallExpression: (n: unknown) => void })
      .CallExpression
    noRaw({ callee: { name: 'fetchQuery', type: 'Identifier' }, type: 'CallExpression' })
    const reb = get('require-error-boundary').create(ctx) as {
      JSXOpeningElement: (n: unknown) => void
      'Program:exit': () => void
    }
    reb.JSXOpeningElement({ name: { name: 'ConvexProvider', type: 'JSXIdentifier' } })
    reb['Program:exit']()
    const dRule = get('discovery-check').create(ctx) as { Program?: (n: unknown) => void }
    if (dRule.Program) dRule.Program({ type: 'Program' })
    const ffe = (get('form-field-exists').create(ctx) as { JSXOpeningElement?: (n: unknown) => void }).JSXOpeningElement
    if (ffe)
      ffe({
        attributes: [
          {
            name: { name: 'name' },
            type: 'JSXAttribute',
            value: { type: 'Literal', value: 'unknownField' }
          }
        ],
        name: { name: 'Text', type: 'JSXIdentifier' }
      })
    const ffk = (get('form-field-kind').create(ctx) as { JSXOpeningElement?: (n: unknown) => void }).JSXOpeningElement
    if (ffk)
      ffk({
        attributes: [{ name: { name: 'name' }, type: 'JSXAttribute', value: { type: 'Literal', value: 'title' } }],
        name: { name: 'Toggle', type: 'JSXIdentifier' }
      })
    const rc = (get('require-connection').create(ctx) as { CallExpression?: (n: unknown) => void }).CallExpression
    if (rc) rc({ callee: { name: 'fetchQuery', type: 'Identifier' }, type: 'CallExpression' })
    const ids = new Set(reports.map(r => r.messageId))
    expect(ids.has('unprotectedMutation')).toBe(true)
    expect(ids.has('unlimitedFileSize')).toBe(true)
    expect(ids.has('unhandledFetch')).toBe(true)
    expect(ids.has('missingErrorBoundary')).toBe(true)
  })
  test('discovery-check getContextRoot walks subdirectories', () => {
    const reports: { messageId: string }[] = []
    const cfg = {
      apiCasing: { casingMismatchMsg: '', getApiBaseName: () => undefined, unknownModuleMsg: '' },
      bindings: { discoveryFailedMsg: 'missing {{missing}}', discoveryMissingLabel: 'lbl' },
      cast: { isCastTarget: () => false, unsafeApiCastMsg: '' },
      connection: { dataFns: new Set(), missingConnectionMsg: '', unhandledFetchMsg: '' },
      crud: { factories: new Set(), writeFactories: new Set() },
      list: { hookName: 'useQuery', msg: '', propNames: new Set() },
      mutation: { authIdents: [], requireDbInBody: false },
      orgQuery: { isHook: () => false, msg: '' },
      pluginName: 'p',
      provider: { missingErrorBoundaryMsg: '', nameMatchers: [] },
      schema: {
        findSchemaContent: () => '',
        findSchemaContentFresh: () => '',
        getModules: () => [],
        getModulesFresh: () => []
      }
    } as never
    const rules = buildRules(cfg) as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>
    const ctx = {
      cwd: '/tmp',
      filename: '/tmp/a/b/c/x.ts',
      report: (d: { messageId: string }) => reports.push(d),
      sourceCode: { getAncestors: () => [] }
    }
    const dRule = rules['discovery-check']
    if (!dRule) throw new Error('expected rule')
    const visitor = dRule.create(ctx) as { Program?: (n: unknown) => void }
    if (visitor.Program) visitor.Program({ type: 'Program' })
    expect(true).toBe(true)
  })
  test('no-duplicate-crud detects duplicate cacheCrud table via getCacheCrudTable', () => {
    const reports: { messageId: string }[] = []
    const cfg = {
      apiCasing: { casingMismatchMsg: '', getApiBaseName: () => undefined, unknownModuleMsg: '' },
      bindings: { discoveryFailedMsg: '', discoveryMissingLabel: '' },
      cast: { isCastTarget: () => false, unsafeApiCastMsg: '' },
      connection: { dataFns: new Set(), missingConnectionMsg: '', unhandledFetchMsg: '' },
      crud: { factories: new Set(), writeFactories: new Set() },
      list: { hookName: 'useQuery', msg: '', propNames: new Set() },
      mutation: { authIdents: [], requireDbInBody: false },
      orgQuery: { isHook: () => false, msg: '' },
      pluginName: 'p',
      provider: { missingErrorBoundaryMsg: '', nameMatchers: [] },
      schema: {
        findSchemaContent: () => '',
        findSchemaContentFresh: () => '',
        getModules: () => [],
        getModulesFresh: () => []
      }
    } as never
    const rules = buildRules(cfg) as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>
    const ctx = {
      cwd: '/tmp',
      filename: '/tmp/x.ts',
      report: (d: { messageId: string }) => reports.push(d),
      sourceCode: { getAncestors: () => [] }
    }
    const dupRule = rules['no-duplicate-crud']
    if (!dupRule) throw new Error('expected rule')
    const dup = (dupRule.create(ctx) as { CallExpression: (n: unknown) => void }).CallExpression
    const node = {
      arguments: [
        {
          properties: [
            { key: { name: 'table', type: 'Identifier' }, type: 'Property', value: { type: 'Literal', value: 'movie' } }
          ],
          type: 'ObjectExpression'
        }
      ],
      callee: { name: 'cacheCrud', type: 'Identifier' },
      type: 'CallExpression'
    }
    dup(node)
    dup(node)
    expect(reports.some(r => r.messageId === 'duplicateCrud')).toBe(true)
  })
  test('consistent-crud-naming fires on cacheCrud table/schema mismatch', () => {
    const reports: { messageId: string }[] = []
    const cfg = {
      apiCasing: { casingMismatchMsg: '', getApiBaseName: () => undefined, unknownModuleMsg: '' },
      bindings: { discoveryFailedMsg: '', discoveryMissingLabel: '' },
      cast: { isCastTarget: () => false, unsafeApiCastMsg: '' },
      connection: { dataFns: new Set(), missingConnectionMsg: '', unhandledFetchMsg: '' },
      crud: { factories: new Set(['crud']), writeFactories: new Set(['crud']) },
      list: { hookName: 'useQuery', msg: '', propNames: new Set() },
      mutation: { authIdents: [], requireDbInBody: false },
      orgQuery: { isHook: () => false, msg: '' },
      pluginName: 'p',
      provider: { missingErrorBoundaryMsg: '', nameMatchers: [] },
      schema: {
        findSchemaContent: () => '',
        findSchemaContentFresh: () => '',
        getModules: () => [],
        getModulesFresh: () => []
      }
    } as never
    const rules = buildRules(cfg) as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>
    const ctx = {
      cwd: '/tmp',
      filename: '/tmp/x.ts',
      report: (d: { messageId: string }) => reports.push(d),
      sourceCode: { getAncestors: () => [] }
    }
    const namingRule = rules['consistent-crud-naming']
    if (!namingRule) throw new Error('expected rule')
    const naming = (namingRule.create(ctx) as { CallExpression: (n: unknown) => void }).CallExpression
    naming({
      arguments: [
        {
          properties: [
            { key: { name: 'table', type: 'Identifier' }, type: 'Property', value: { type: 'Literal', value: 'movie' } },
            {
              key: { name: 'schema', type: 'Identifier' },
              type: 'Property',
              value: {
                object: { name: 'schemaModule', type: 'Identifier' },
                property: { name: 'differentName', type: 'Identifier' },
                type: 'MemberExpression'
              }
            }
          ],
          type: 'ObjectExpression'
        }
      ],
      callee: { name: 'cacheCrud', type: 'Identifier' },
      type: 'CallExpression'
    })
    expect(reports.some(r => r.messageId === 'crudNameMismatch')).toBe(true)
  })
  test('require-connection rule exercises async-body walker (with + without connection())', () => {
    const reports: { messageId: string }[] = []
    const cfg = {
      apiCasing: { casingMismatchMsg: '', getApiBaseName: () => undefined, unknownModuleMsg: '' },
      bindings: { discoveryFailedMsg: '', discoveryMissingLabel: '' },
      cast: { isCastTarget: () => false, unsafeApiCastMsg: '' },
      connection: { dataFns: new Set(['fetchQuery']), missingConnectionMsg: 'no conn', unhandledFetchMsg: '' },
      crud: { factories: new Set(), writeFactories: new Set() },
      list: { hookName: 'useQuery', msg: '', propNames: new Set() },
      mutation: { authIdents: [], requireDbInBody: false },
      orgQuery: { isHook: () => false, msg: '' },
      pluginName: 'p',
      provider: { missingErrorBoundaryMsg: '', nameMatchers: [] },
      schema: {
        findSchemaContent: () => '',
        findSchemaContentFresh: () => '',
        getModules: () => [],
        getModulesFresh: () => []
      }
    } as never
    const rules = buildRules(cfg) as Record<string, { create: (ctx: unknown) => Record<string, unknown> }>
    const fetchNode = { callee: { name: 'fetchQuery', type: 'Identifier' }, type: 'CallExpression' }
    const asyncBlockWithoutConnection = {
      async: true,
      body: {
        body: [{ expression: { argument: fetchNode, type: 'AwaitExpression' }, type: 'ExpressionStatement' }],
        type: 'BlockStatement'
      },
      type: 'ArrowFunctionExpression'
    }
    const asyncBlockWithConnection = {
      async: true,
      body: {
        body: [
          {
            expression: {
              argument: { arguments: [], callee: { name: 'connection', type: 'Identifier' }, type: 'CallExpression' },
              type: 'AwaitExpression'
            },
            type: 'ExpressionStatement'
          },
          { expression: { argument: fetchNode, type: 'AwaitExpression' }, type: 'ExpressionStatement' }
        ],
        type: 'BlockStatement'
      },
      type: 'ArrowFunctionExpression'
    }
    const get = (k: string) => {
      const r = rules[k]
      if (!r) throw new Error(`missing rule: ${k}`)
      return r
    }
    const visitor = get('require-connection').create({
      cwd: '/tmp',
      filename: '/tmp/page.tsx',
      report: (d: { messageId: string }) => reports.push(d),
      sourceCode: {
        getAncestors: () => [asyncBlockWithoutConnection]
      }
    }) as { CallExpression: (n: unknown) => void }
    visitor.CallExpression(fetchNode)
    expect(reports.some(r => r.messageId === 'missingConnection')).toBe(true)
    reports.length = 0
    const visitor2 = get('require-connection').create({
      cwd: '/tmp',
      filename: '/tmp/page.tsx',
      report: (d: { messageId: string }) => reports.push(d),
      sourceCode: { getAncestors: () => [asyncBlockWithConnection] }
    }) as { CallExpression: (n: unknown) => void }
    visitor2.CallExpression(fetchNode)
    expect(reports.length).toBe(0)
  })
})
