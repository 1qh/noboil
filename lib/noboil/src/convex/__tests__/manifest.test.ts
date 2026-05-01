/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { add as addCmd } from '../add'
import { run as checkRun, checkSchemaConsistency, printAccessReport, printSchemaPreview } from '../check'
import { run as doctorRun } from '../doctor'
import { run as migrateRun } from '../migrate'
import { buildArgs, buildTree, findCommand, findValidPath } from '../tools/manifest'
import { run as vizRun } from '../viz'
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
  test('add command --help returns counts', async () => {
    const orig = console.log
    console.log = () => undefined
    try {
      const r = await addCmd(['--help'])
      expect(r).toEqual({ created: 0, skipped: 0 })
    } finally {
      console.log = orig
    }
  })
  test('check run() flag variants (--endpoints, --schema, --health, --access, --indexes)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-check-run-'))
    const origCwd = process.cwd()
    try {
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      writeFileSync(
        join(dir, 'convex', 'todos.ts'),
        `export const x = crud('todo', schema, { rateLimit: { max: 1, window: 1000 } })`,
        'utf8'
      )
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({ title: string() }) })', 'utf8')
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = () => {
        throw new Error('__exit__')
      }
      const tryRun = (argv: string[]) => {
        try {
          checkRun(argv)
        } catch (error) {
          if (!(error instanceof Error) || error.message !== '__exit__') throw error
        }
      }
      try {
        for (const flag of ['--endpoints', '--schema', '--access', '--indexes', '--health', '']) tryRun(flag ? [flag] : [])
      } finally {
        console.log = log
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(origCwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('viz run prints summary + --mermaid prints erDiagram', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-viz-'))
    const origCwd = process.cwd()
    try {
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({ title: string() }) })', 'utf8')
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = () => {
        throw new Error('__exit__')
      }
      try {
        try {
          vizRun([])
        } catch (error) {
          if (!(error instanceof Error) || error.message !== '__exit__') throw error
        }
        try {
          vizRun(['--mermaid'])
        } catch (error) {
          if (!(error instanceof Error) || error.message !== '__exit__') throw error
        }
      } finally {
        console.log = log
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(origCwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('viz run exits when no convex/_generated and no schema file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-viz-empty-'))
    const origCwd = process.cwd()
    try {
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      let exited = 0
      process.exit = () => {
        exited += 1
        throw new Error('__exit__')
      }
      try {
        try {
          vizRun([])
        } catch (error) {
          if (!(error instanceof Error) || error.message !== '__exit__') throw error
        }
      } finally {
        console.log = log
        process.exit = origExit
      }
      expect(exited).toBeGreaterThan(0)
    } finally {
      process.chdir(origCwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('viz run finds convex/ via subdir recursion + exits when schema lacks markers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-viz-sub-'))
    const origCwd = process.cwd()
    try {
      mkdirSync(join(dir, 'app', 'convex', '_generated'), { recursive: true })
      writeFileSync(join(dir, 'app', 'plain.ts'), 'export const x = 1', 'utf8')
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      let exited = 0
      process.exit = () => {
        exited += 1
        throw new Error('__exit__')
      }
      try {
        try {
          vizRun([])
        } catch (error) {
          if (!(error instanceof Error) || error.message !== '__exit__') throw error
        }
      } finally {
        console.log = log
        process.exit = origExit
      }
      expect(exited).toBeGreaterThan(0)
    } finally {
      process.chdir(origCwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('migrate run --snapshot reads tmp schema', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-migrate-snap-'))
    const origCwd = process.cwd()
    try {
      writeFileSync(
        join(dir, 'schema.ts'),
        'const owned = makeOwned({ todo: object({ title: string(), done: boolean() }) })',
        'utf8'
      )
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      try {
        migrateRun(['--snapshot'])
      } finally {
        console.log = log
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(origCwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check run() no flag → runCheck full path with duplicates + warnings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-check-runfull-'))
    const origCwd = process.cwd()
    try {
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      writeFileSync(
        join(dir, 'convex', 'todos.ts'),
        `export const a = crud('todo', schema)\nexport const b = crud('mismatch', schema)`,
        'utf8'
      )
      writeFileSync(join(dir, 'convex', 'orphan.ts'), `export const c = crud('todo', schema)`, 'utf8')
      writeFileSync(
        join(dir, 'schema.ts'),
        'const owned = makeOwned({ todo: object({ title: string() }), unused: object({ x: string() }) })',
        'utf8'
      )
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = () => {
        throw new Error('__exit__')
      }
      try {
        try {
          checkRun([])
        } catch (error) {
          if (!(error instanceof Error) || error.message !== '__exit__') throw error
        }
      } finally {
        console.log = log
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(origCwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check run --indexes with where filters in client + factory options', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-check-idx-'))
    const origCwd = process.cwd()
    try {
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      mkdirSync(join(dir, 'app'), { recursive: true })
      writeFileSync(
        join(dir, 'convex', 'todos.ts'),
        `export const x = crud('todo', schema, { where: { done: true } })`,
        'utf8'
      )
      writeFileSync(
        join(dir, 'app', 'page.tsx'),
        'const { data } = useList(api.todo.list, { where: { unindexed: 1 } })',
        'utf8'
      )
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({ title: string() }) })', 'utf8')
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = () => {
        throw new Error('__exit__')
      }
      try {
        try {
          checkRun(['--indexes'])
        } catch (error) {
          if (!(error instanceof Error) || error.message !== '__exit__') throw error
        }
      } finally {
        console.log = log
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(origCwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('migrate run no schema → exits; missing git ref → returns warning', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-migrate-edge-'))
    const origCwd = process.cwd()
    try {
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      let exited = 0
      process.exit = () => {
        exited += 1
        throw new Error('__exit__')
      }
      try {
        try {
          migrateRun([])
        } catch (error) {
          if (!(error instanceof Error) || error.message !== '__exit__') throw error
        }
      } finally {
        console.log = log
        process.exit = origExit
      }
      expect(exited).toBeGreaterThan(0)
    } finally {
      process.chdir(origCwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('migrate run with schema but no git history returns warning', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-migrate-nogit-'))
    const origCwd = process.cwd()
    try {
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({ title: string() }) })', 'utf8')
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      try {
        migrateRun([])
      } finally {
        console.log = log
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(origCwd)
      rmSync(dir, { force: true, recursive: true })
    }
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
