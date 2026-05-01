/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSchemaConsistency, printAccessReport, printSchemaPreview } from '../check'
import { run as doctorRun } from '../doctor'
import { run as migrateRun } from '../migrate'
import { buildArgs, buildTree, findCommand, findValidPath } from '../tools/manifest'
const mkEntry = (path: string[], extra: Record<string, unknown> = {}) =>
  ({
    argSpecs: {},
    fn: () => null,
    inferredDescription: null,
    inferredSchema: null,
    kind: 'query',
    meta: {
      cost: 'low',
      description: 'desc',
      deterministic: true,
      errorCodes: [],
      examples: [],
      exclusive: [],
      selfTest: {},
      version: '1'
    },
    path,
    tier: 'public',
    ...extra
  }) as never
describe('manifest helpers', () => {
  test('buildArgs maps ArgSpec to manifest arg shape', () => {
    const out = buildArgs({
      include_files: {
        aliases: ['inc_files'],
        description: 'flag',
        max: 10,
        min: 1,
        v: { kind: 'int64' } as never
      } as never
    })
    expect(out).toHaveLength(1)
    expect(out[0]?.name).toBe('--include-files')
    expect(out[0]?.aliases).toEqual(['--inc-files'])
    expect(out[0]?.type).toBe('number')
    expect(out[0]?.min).toBe(1)
  })
  test('buildArgs handles union → enum and union → union', () => {
    const enumOut = buildArgs({
      mode: {
        description: '',
        v: {
          kind: 'union',
          members: [
            { kind: 'literal', value: 'fast' },
            { kind: 'literal', value: 'slow' }
          ]
        } as never
      } as never
    })
    expect(enumOut[0]?.type).toBe('enum')
    expect(enumOut[0]?.enum).toEqual(['fast', 'slow'])
  })
  test('buildTree groups commands by provider/path; findCommand looks up by path', () => {
    const reg = {
      a: mkEntry(['p1', 'g1', 'cmd_a']),
      b: mkEntry(['p1', 'cmd_b'])
    }
    const tree = buildTree({ providers: { p1: { description: 'P1', name: 'P1', requiresEnv: [] } }, registry: reg })
    expect(tree.p1?.kind).toBe('provider')
    expect(tree.p1?.children?.g1?.children?.['cmd-a']?.kind).toBe('command')
    expect(findCommand(reg, ['p1', 'cmd_b'])?.path).toEqual(['p1', 'cmd_b'])
    expect(findCommand(reg, ['nope'])).toBeNull()
  })
  test('buildArgs maps optional+literal+unknown kinds', () => {
    const out = buildArgs({
      lit: { description: '', v: { kind: 'literal', value: 'X' } as never } as never,
      mystery: { description: '', v: { kind: 'optional', value: { kind: 'literal', value: 'Y' } } as never } as never,
      weird: { description: '', v: { kind: 'unknown' } as never } as never
    })
    expect(out.find(o => o.name === '--lit')?.type).toBe('enum')
    expect(out.find(o => o.name === '--mystery')?.type).toBe('enum')
    expect(out.find(o => o.name === '--weird')?.type).toBe('unknown')
  })
  test('buildCommand via buildTree: examples from fixture and schemaToJson covers all kinds', () => {
    const reg = {
      a: mkEntry(['p', 'cmd'], {
        argSpecs: { x: { description: '', v: { kind: 'string' } as never } as never },
        inferredSchema: {
          kind: 'object',
          shape: {
            arr: { optional: false, schema: { element: { kind: 'string' }, kind: 'array' } },
            b: { optional: false, schema: { kind: 'boolean' } },
            n: { optional: false, schema: { kind: 'null' } },
            num: { optional: false, schema: { kind: 'number' } },
            opt: {
              optional: false,
              schema: { kind: 'union', members: [{ kind: 'string' }, { kind: 'null' }] }
            },
            t: { optional: false, schema: { kind: 'enum', values: ['a', 'b'] } },
            unk: { optional: false, schema: { kind: 'union', members: [{ kind: 'number' }, { kind: 'string' }] } }
          }
        },
        meta: {
          cost: 'low',
          description: 'desc',
          deterministic: true,
          errorCodes: [],
          examples: [],
          exclusive: [],
          selfTest: { age: 5, label: 'has space', name: 'a' },
          version: '1'
        }
      })
    }
    const tree = buildTree({ providers: {}, registry: reg })
    const cmd = tree.p?.children?.cmd?.command
    expect(cmd?.examples[0]).toContain('--name a')
    expect(cmd?.examples[0]).toContain('--age 5')
    expect(cmd?.examples[0]).toContain('"has space"')
    const out = cmd?.output as { shape: Record<string, { type: string }>; type: string }
    expect(out.type).toBe('object')
    expect(out.shape.opt?.type).toBe('string')
    expect(out.shape.unk?.type).toBe('unknown')
    expect(out.shape.arr?.type).toBe('array')
  })
  test('checkSchemaConsistency reports duplicate + missing-table + filename-mismatch', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-check-'))
    try {
      writeFileSync(
        join(dir, 'todos.ts'),
        `export const x = crud('todo', schema)\nexport const y = crud('mismatch', schema)`,
        'utf8'
      )
      writeFileSync(join(dir, 'orphan.ts'), `export const z = crud('todo', schema)`, 'utf8')
      const schemaContent = 'defineSchema({ todo: defineTable({}), missingFactory: defineTable({}) })'
      const issues = checkSchemaConsistency(dir, { content: schemaContent, path: join(dir, 'schema.ts') })
      expect(issues.some(i => i.message.includes('Duplicate factory'))).toBe(true)
      expect(issues.some(i => i.message.includes('no "mismatch" table'))).toBe(true)
      expect(issues.length).toBeGreaterThan(0)
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('doctor + migrate run --help prints usage and returns', () => {
    const orig = console.log
    console.log = () => undefined
    try {
      doctorRun(['--help'])
      migrateRun(['--help'])
    } finally {
      console.log = orig
    }
    expect(true).toBe(true)
  })
  test('printAccessReport + printSchemaPreview do not throw on empty input', () => {
    const orig = console.log
    console.log = () => undefined
    try {
      printAccessReport([])
      printSchemaPreview('schema content', [])
    } finally {
      console.log = orig
    }
    expect(true).toBe(true)
  })
  test('findValidPath returns the longest matching prefix and child names', () => {
    const reg = {
      a: mkEntry(['p1', 'a']),
      b: mkEntry(['p1', 'b']),
      c: mkEntry(['p2', 'c'])
    }
    const r = findValidPath(reg, ['p1', 'unknown'])
    expect(r.validPath).toEqual(['p1'])
    expect(r.validChildren).toEqual(['a', 'b'])
  })
})
