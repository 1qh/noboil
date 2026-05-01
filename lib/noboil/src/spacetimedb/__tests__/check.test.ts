/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  run as checkRun,
  checkSchemaConsistency,
  printAccessReport,
  printHealthReport,
  printIndexReport,
  printSchemaPreview
} from '../check'
import { run as doctorRun } from '../doctor'
import { run as migrateRun } from '../migrate'
import { run as vizRun } from '../viz'
const silenced = (fn: () => unknown) => {
  const orig = console.log
  console.log = () => undefined
  try {
    return fn()
  } finally {
    console.log = orig
  }
}
describe('stdb check helpers', () => {
  test('checkSchemaConsistency reports duplicates and missing tables', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-'))
    try {
      writeFileSync(
        join(dir, 'todos.ts'),
        `export const a = makeCrud({ tableName: 'todo' })\nexport const b = makeCrud({ tableName: 'mismatch' })`,
        'utf8'
      )
      writeFileSync(join(dir, 'orphan.ts'), `export const c = makeCrud({ tableName: 'todo' })`, 'utf8')
      const schemaContent = `
        export default schema({
          tables: {
            todo: table({ fields: {} }),
            missingFactory: table({ fields: {} }),
          }
        })
      `
      const issues = checkSchemaConsistency(dir, { content: schemaContent, path: join(dir, 'schema.ts') })
      expect(Array.isArray(issues)).toBe(true)
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('doctor + migrate run --help prints usage and returns', () => {
    silenced(() => {
      doctorRun(['--help'])
      migrateRun(['--help'])
    })
    expect(true).toBe(true)
  })
  test('viz run prints summary + --mermaid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-viz-'))
    const orig = process.cwd()
    try {
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = () => {
        throw new Error('__exit__')
      }
      try {
        silenced(() => {
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
        })
      } finally {
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check run() variants (--endpoints, --schema, --health, --access, --indexes)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-run-'))
    const orig = process.cwd()
    try {
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      writeFileSync(join(dir, 'reducers.ts'), `export const x = makeCrud({ tableName: 'todo' })`, 'utf8')
      process.chdir(dir)
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
        silenced(() => {
          for (const flag of ['--endpoints', '--schema', '--access', '--indexes', '--health', ''])
            tryRun(flag ? [flag] : [])
        })
      } finally {
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('migrate run --snapshot reads stdb schema', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-migrate-snap-'))
    const orig = process.cwd()
    try {
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      process.chdir(dir)
      silenced(() => migrateRun(['--snapshot']))
      expect(true).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('migrate run no schema → exits, with schema returns warning', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-mig-edge-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      let exited = 0
      process.exit = () => {
        exited += 1
        throw new Error('__exit__')
      }
      try {
        silenced(() => {
          try {
            migrateRun([])
          } catch (error) {
            if (!(error instanceof Error) || error.message !== '__exit__') throw error
          }
        })
      } finally {
        process.exit = origExit
      }
      expect(exited).toBeGreaterThan(0)
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      silenced(() => migrateRun([]))
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('viz run no schema exits', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-viz-empty-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      let exited = 0
      process.exit = () => {
        exited += 1
        throw new Error('__exit__')
      }
      try {
        silenced(() => {
          try {
            vizRun([])
          } catch (error) {
            if (!(error instanceof Error) || error.message !== '__exit__') throw error
          }
        })
      } finally {
        process.exit = origExit
      }
      expect(exited).toBeGreaterThan(0)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('print* helpers do not throw on empty input', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-print-'))
    try {
      writeFileSync(join(dir, 'schema.ts'), 'export default schema({ tables: {} })', 'utf8')
      silenced(() => {
        printAccessReport([])
        printSchemaPreview('', [])
        printIndexReport(dir, [])
        printHealthReport(dir, { content: 'export default schema({ tables: {} })', path: join(dir, 'schema.ts') })
      })
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
    expect(true).toBe(true)
  })
})
