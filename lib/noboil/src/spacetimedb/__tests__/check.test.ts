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
import { captured } from '../../shared/test'

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
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-'))
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'todos.ts'),
        `export const a = makeCrud({ tableName: 'todo' })\nreducer('todo.create', () => undefined)\nreducer('mismatch.create', () => undefined)`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
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
      expect(issues.length).toBeGreaterThan(0)
      expect(issues.some(i => i.level === 'error' && i.message.includes('mismatch'))).toBe(true)
      expect(issues.some(i => i.level === 'error' && i.message.includes('missing in schema'))).toBe(true)
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('doctor + migrate run --help prints usage and returns', () => {
    const { out } = captured(() => {
      doctorRun(['--help'])
      migrateRun(['--help'])
    })
    expect(out).toContain('Usage: noboil stdb doctor')
    expect(out).toContain('Usage: noboil stdb migrate')
  })
  test('viz run prints summary + --mermaid', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-viz-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
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
      let out = ''
      try {
        out = captured(() => {
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
        }).out
      } finally {
        process.exit = origExit
      }
      expect(out).toContain('Schema Summary')
      expect(out).toContain('erDiagram')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check run() variants (--endpoints, --schema, --health, --access, --indexes)', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-run-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'reducers.ts'),
        `export const x = makeCrud({ tableName: 'todo' })\nreducer('todo.create', () => undefined)\nreducer('todo.list', () => undefined)\nreducer('todo.rm', () => undefined)`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
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
      let out = ''
      try {
        out = captured(() => {
          for (const flag of ['--endpoints', '--schema', '--access', '--indexes', '--health', ''])
            tryRun(flag ? [flag] : [])
        }).out
      } finally {
        process.exit = origExit
      }
      expect(out).toContain('Registered Reducers')
      expect(out).toContain('Schema Preview')
      expect(out).toContain('Access Control Matrix')
      expect(out).toContain('Index Analysis')
      expect(out).toContain('Project Health Report')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('migrate run --snapshot reads stdb schema', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-migrate-snap-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      process.chdir(dir)
      const { out } = captured(() => migrateRun(['--snapshot']))
      expect(out).toContain('1 table(s)')
      expect(out).toContain('todo')
      expect(out).toContain('id: number')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb migrate run "no changes" path (printMigrationPlan early return)', async () => {
    const { execSync } = await import('node:child_process')
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-mig-noop-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      // oxlint-disable-next-line node/no-sync
      execSync('git init -q', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git config user.email "t@t"', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git config user.name "t"', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      execSync('git add -A', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git commit -q -m initial', { cwd: dir })
      const { out } = captured(() => migrateRun([]))
      expect(out).toContain('No schema changes detected')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb migrate run hits all dangerous branches (fieldAddedReq + fieldRemoved + fieldTypeChanged + tableRemoved)', async () => {
    const { execSync } = await import('node:child_process')
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-mig-dang-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      // oxlint-disable-next-line node/no-sync
      execSync('git init -q', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git config user.email "t@t"', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git config user.name "t"', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), removed: t.string(), changed: t.string() }), gone: table(t.u64(), { id: t.u64() }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      execSync('git add -A', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git commit -q -m initial', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), changed: t.f64(), addedReq: t.string() }) } })',
        'utf8'
      )
      const { out } = captured(() => migrateRun([]))
      expect(out).toContain('change(s) detected')
      expect(out).toContain('Requires staged publish plan')
      expect(out).toContain('Remove table')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb migrate run "optional field added" only safe branch', async () => {
    const { execSync } = await import('node:child_process')
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-mig-opt-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      // oxlint-disable-next-line node/no-sync
      execSync('git init -q', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git config user.email "t@t"', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git config user.name "t"', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      execSync('git add -A', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git commit -q -m initial', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string(), bio: t.option(t.string()) }) } })',
        'utf8'
      )
      const { out } = captured(() => migrateRun([]))
      expect(out).toContain('No schema changes detected')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check run() no-flag with duplicate reducer groups + missing schema table + unindexed where', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-runfull-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }), unused: table(t.u64(), { id: t.u64() }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'reducers_a.ts'),
        `export const a = makeCrud({ tableName: 'todo' })\nreducer('todo.create', () => undefined)\nreducer('todo.list', () => undefined)`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'reducers_b.ts'),
        `export const b = makeCrud({ tableName: 'todo' })\nreducer('todo.rm', () => undefined)`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
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
      let out = ''
      try {
        out = captured(() => {
          try {
            checkRun([])
          } catch (error) {
            if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
          }
        }).out
      } finally {
        process.exit = origExit
      }
      expect(out).toContain('no table named "gone"')
      expect(out).toContain('unused')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check run() no-flag clean schema → all-checks-passed branch', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-clean-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
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
      let out = ''
      try {
        out = captured(() => {
          try {
            checkRun([])
          } catch (error) {
            if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
          }
        }).out
      } finally {
        process.exit = origExit
      }
      expect(out).toContain('All checks passed')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check run() --indexes + --access + --health with all factory types + where filters', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-divf-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        `export default schema({
          tables: {
            todo: table(t.u64(), { id: t.u64(), title: t.string() }),
            project: table(t.u64(), { id: t.u64(), name: t.string() }),
            message: table(t.u64(), { id: t.u64(), text: t.string() }),
            movie: table(t.u64(), { id: t.u64(), title: t.string() })
          }
        })`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'todo.ts'),
        `export const x = makeCrud({ tableName: 'todo' })\nreducer('todo.create', () => undefined)`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'project.ts'),
        `export const x = makeOrg({ tableName: 'project' })\nreducer('project.create', () => undefined)`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'message.ts'),
        `export const x = makeChildCrud({ tableName: 'message' })\nreducer('message.create', () => undefined)`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'movie.ts'),
        `export const x = makeCacheCrud({ tableName: 'movie' })\nreducer('movie.refresh', () => undefined)`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'app.ts'),
        'useList(api.todo.list, { where: { unindexed_a: 1 } })\nuseList(api.project.list, { where: { unindexed_b: 2 } })',
        'utf8'
      )
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = (c?: number) => {
        throw new Error(`__exit__${String(c)}`)
      }
      const tryRun = (argv: string[]) => {
        try {
          checkRun(argv)
        } catch (error) {
          if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
        }
      }
      let out = ''
      try {
        out = captured(() => {
          for (const flag of ['--indexes', '--access', '--health', '--schema', '--endpoints', ''])
            tryRun(flag ? [flag] : [])
        }).out
      } finally {
        process.exit = origExit
      }
      expect(out).toContain('Index Analysis')
      expect(out).toContain('Access Control Matrix')
      expect(out).toContain('Project Health Report')
      expect(out).toContain('100/100')
      expect(out).toContain('No unindexed where clauses detected')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('check finds schema in nested */module/ subdirectory', async () => {
    const { mkdirSync } = await import('node:fs')
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-check-sub-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'app', 'module'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'app', 'module', 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'app', 'module', 'reducers.ts'), `export const x = makeCrud({ tableName: 'todo' })`, 'utf8')
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = (c?: number) => {
        throw new Error(`__exit__${String(c)}`)
      }
      let out = ''
      try {
        out = captured(() => {
          try {
            checkRun([])
          } catch (error) {
            if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
          }
        }).out
      } finally {
        process.exit = origExit
      }
      expect(out).toContain('tables in schema:')
      expect(out).toContain('todo')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb migrate finds schema in module/ subdirectory', async () => {
    const { mkdirSync } = await import('node:fs')
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-mig-mod-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'module'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'module', 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      process.chdir(dir)
      const { out } = captured(() => migrateRun(['--snapshot']))
      expect(out).toContain('table(s):')
      expect(out).toContain('todo')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb migrate run with git history triggers printMigrationPlan branches', async () => {
    const { execSync } = await import('node:child_process')
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-migrate-git-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      // oxlint-disable-next-line node/no-sync
      execSync('git init -q', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git config user.email "t@t"', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git config user.name "t"', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string(), removed: t.string(), changed: t.string() }), gone: table(t.u64(), { id: t.u64() }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      execSync('git add -A', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      execSync('git commit -q -m initial', { cwd: dir })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string(), changed: t.f64(), addedReq: t.string() }), brandNew: table(t.u64(), { id: t.u64() }) } })',
        'utf8'
      )
      const { out } = captured(() => migrateRun([]))
      expect(out).toContain('Likely safe with republish')
      expect(out).toContain('brandNew')
      expect(out).toContain('Requires staged publish plan')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('migrate run no schema → exits, with schema returns warning', () => {
    // oxlint-disable-next-line node/no-sync
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
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      silenced(() => migrateRun([]))
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('viz run no schema exits', () => {
    // oxlint-disable-next-line node/no-sync
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
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb add cmd: --help, dry-run for each type, real run, child requires parent', async () => {
    const { add: addCmd } = await import('../add')
    // oxlint-disable-next-line node/no-sync
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
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('stdb add exits with no name + child without parent', async () => {
    const { add: addCmd } = await import('../add')
    /* eslint-disable no-console */
    const { log } = console
    console.log = () => undefined
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const origExit = process.exit
    let exited = 0
    process.exit = (c?: number) => {
      exited += 1
      throw new Error(`__exit__${String(c)}`)
    }
    try {
      try {
        await addCmd(['--type=owned'])
      } catch (error) {
        if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
      }
      try {
        await addCmd(['--name', 'm', '--type=child'])
      } catch (error) {
        if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
      }
    } finally {
      console.log = log
      process.exit = origExit
    }
    expect(exited).toBeGreaterThan(0)
  })
  test('print* helpers do not throw on empty input', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-print-'))
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'schema.ts'), 'export default schema({ tables: {} })', 'utf8')
      expect(() =>
        silenced(() => {
          printAccessReport([])
          printSchemaPreview('', [])
          printIndexReport(dir, [])
          printHealthReport(dir, { content: 'export default schema({ tables: {} })', path: join(dir, 'schema.ts') })
        })
      ).not.toThrow()
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
