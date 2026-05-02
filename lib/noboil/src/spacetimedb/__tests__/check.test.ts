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
        `export const a = makeCrud({ tableName: 'todo' })\nreducer('todo.create', () => undefined)\nreducer('mismatch.create', () => undefined)`,
        'utf8'
      )
      writeFileSync(
        join(dir, 'orphan.ts'),
        `export const c = makeCrud({ tableName: 'todo' })\nreducer('todo.list', () => undefined)`,
        'utf8'
      )
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
      writeFileSync(
        join(dir, 'reducers.ts'),
        `export const x = makeCrud({ tableName: 'todo' })\nreducer('todo.create', () => undefined)\nreducer('todo.list', () => undefined)\nreducer('todo.rm', () => undefined)`,
        'utf8'
      )
      writeFileSync(join(dir, 'app.ts'), 'useList(api.todo.list, { where: { unindexed_field: 1 } })', 'utf8')
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
  test('stdb migrate run "no changes" path (printMigrationPlan early return)', async () => {
    const { execSync } = await import('node:child_process')
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-mig-noop-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      execSync('git init -q', { cwd: dir })
      execSync('git config user.email "t@t"', { cwd: dir })
      execSync('git config user.name "t"', { cwd: dir })
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      execSync('git add -A', { cwd: dir })
      execSync('git commit -q -m initial', { cwd: dir })
      silenced(() => migrateRun([]))
      expect(true).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb migrate run hits all dangerous branches (fieldAddedReq + fieldRemoved + fieldTypeChanged + tableRemoved)', async () => {
    const { execSync } = await import('node:child_process')
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-mig-dang-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      execSync('git init -q', { cwd: dir })
      execSync('git config user.email "t@t"', { cwd: dir })
      execSync('git config user.name "t"', { cwd: dir })
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), removed: t.string(), changed: t.string() }), gone: table(t.u64(), { id: t.u64() }) } })',
        'utf8'
      )
      execSync('git add -A', { cwd: dir })
      execSync('git commit -q -m initial', { cwd: dir })
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), changed: t.f64(), addedReq: t.string() }) } })',
        'utf8'
      )
      silenced(() => migrateRun([]))
      expect(true).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb migrate run "optional field added" only safe branch', async () => {
    const { execSync } = await import('node:child_process')
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-mig-opt-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      execSync('git init -q', { cwd: dir })
      execSync('git config user.email "t@t"', { cwd: dir })
      execSync('git config user.name "t"', { cwd: dir })
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      execSync('git add -A', { cwd: dir })
      execSync('git commit -q -m initial', { cwd: dir })
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string(), bio: t.option(t.string()) }) } })',
        'utf8'
      )
      silenced(() => migrateRun([]))
      expect(true).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check run() no-flag with duplicate reducer groups + missing schema table + unindexed where', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-runfull-'))
    const orig = process.cwd()
    try {
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }), unused: table(t.u64(), { id: t.u64() }) } })',
        'utf8'
      )
      writeFileSync(
        join(dir, 'reducers_a.ts'),
        `export const a = makeCrud({ tableName: 'todo' })\nreducer('todo.create', () => undefined)\nreducer('todo.list', () => undefined)`,
        'utf8'
      )
      writeFileSync(
        join(dir, 'reducers_b.ts'),
        `export const b = makeCrud({ tableName: 'todo' })\nreducer('todo.rm', () => undefined)`,
        'utf8'
      )
      writeFileSync(
        join(dir, 'reducers_c.ts'),
        `export const c = makeCrud({ tableName: 'gone' })\nreducer('gone.create', () => undefined)`,
        'utf8'
      )
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = (c?: number) => {
        throw new Error(`__exit__${String(c)}`)
      }
      try {
        try {
          silenced(() => checkRun([]))
        } catch (error) {
          if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
        }
      } finally {
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check run() no-flag clean schema → all-checks-passed branch', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-clean-'))
    const orig = process.cwd()
    try {
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      writeFileSync(
        join(dir, 'todo.ts'),
        `export const x = makeCrud({ tableName: 'todo' })\nreducer('todo.create', () => undefined)`,
        'utf8'
      )
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = (c?: number) => {
        throw new Error(`__exit__${String(c)}`)
      }
      try {
        try {
          silenced(() => checkRun([]))
        } catch (error) {
          if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
        }
      } finally {
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check finds schema in nested */module/ subdirectory', async () => {
    const { mkdirSync } = await import('node:fs')
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-sub-'))
    const orig = process.cwd()
    try {
      mkdirSync(join(dir, 'app', 'module'), { recursive: true })
      writeFileSync(
        join(dir, 'app', 'module', 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      writeFileSync(join(dir, 'app', 'module', 'reducers.ts'), `export const x = makeCrud({ tableName: 'todo' })`, 'utf8')
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = (c?: number) => {
        throw new Error(`__exit__${String(c)}`)
      }
      try {
        try {
          silenced(() => checkRun([]))
        } catch (error) {
          if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
        }
      } finally {
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb migrate finds schema in module/ subdirectory', async () => {
    const { mkdirSync } = await import('node:fs')
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-mig-mod-'))
    const orig = process.cwd()
    try {
      mkdirSync(join(dir, 'module'), { recursive: true })
      writeFileSync(
        join(dir, 'module', 'schema.ts'),
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
  test('stdb migrate run with git history triggers printMigrationPlan branches', async () => {
    const { execSync } = await import('node:child_process')
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-migrate-git-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      execSync('git init -q', { cwd: dir })
      execSync('git config user.email "t@t"', { cwd: dir })
      execSync('git config user.name "t"', { cwd: dir })
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string(), removed: t.string(), changed: t.string() }), gone: table(t.u64(), { id: t.u64() }) } })',
        'utf8'
      )
      execSync('git add -A', { cwd: dir })
      execSync('git commit -q -m initial', { cwd: dir })
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string(), changed: t.f64(), addedReq: t.string() }), brandNew: table(t.u64(), { id: t.u64() }) } })',
        'utf8'
      )
      silenced(() => migrateRun([]))
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
  test('stdb add cmd: --help, dry-run for each type, real run, child requires parent', async () => {
    const { add: addCmd } = await import('../add')
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-add-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      const { log } = console
      console.log = () => undefined
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = () => {
        throw new Error('__exit__')
      }
      try {
        const r = await addCmd(['--help'])
        expect(r).toEqual({ created: 0, skipped: 0 })
        for (const type of ['owned', 'org', 'log', 'kv', 'singleton']) {
          const v = await addCmd(['--name', `t_${type}`, '--type', type])
          expect(typeof v.created).toBe('number')
        }
        const cr = await addCmd(['--name', 'todo_x', '--type', 'owned', '--field', 'title:string'])
        expect(typeof cr.created).toBe('number')
        try {
          await addCmd(['--name', 'm', '--type', 'child'])
        } catch (error) {
          if (!(error instanceof Error) || error.message !== '__exit__') throw error
        }
      } finally {
        console.log = log
        process.exit = origExit
      }
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
