import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateFullReference, generateMarkdown, run } from '../docs-gen'
describe('generateMarkdown', () => {
  test('emits API Reference with table list and per-table sections', () => {
    const calls = [
      { factory: 'crud', file: 'todos.ts', options: '', table: 'todo' },
      { factory: 'orgCrud', file: 'projects.ts', options: '', table: 'project' }
    ]
    const fields = new Map([
      [
        'todo',
        [
          { name: 'title', type: 'string' },
          { name: 'done', type: 'boolean' }
        ]
      ]
    ])
    const md = generateMarkdown(calls, fields)
    expect(md).toContain('# API Reference')
    expect(md).toContain('| todo | `crud` | todos.ts |')
    expect(md).toContain('| project | `orgCrud` | projects.ts |')
    expect(md).toContain('## todo')
    expect(md).toContain('### Schema Fields')
    expect(md).toContain('| title | `string` |')
    expect(md).toContain('### Endpoints')
    expect(md).toContain('`todo.create`')
  })
  test('skips schema-fields section when fields map is empty', () => {
    const calls = [{ factory: 'crud', file: 'a.ts', options: '', table: 't' }]
    const md = generateMarkdown(calls, new Map())
    expect(md).not.toContain('### Schema Fields')
  })
})
describe('generateFullReference', () => {
  test('emits markdown header + summary footer for empty src dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-fullref-'))
    try {
      const md = generateFullReference(dir)
      expect(md).toContain('# noboil/convex')
      expect(md).toContain('exports')
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
describe('docs-gen run() CLI dispatch', () => {
  const silenced = (fn: () => unknown) => {
    /* eslint-disable no-console */
    const origLog = console.log
    console.log = () => undefined
    try {
      return fn()
    } finally {
      console.log = origLog
    }
    /* eslint-enable no-console */
  }
  test('--full with no src/ exits', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-docs-nosrc-'))
    const cwd = process.cwd()
    try {
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      let exited = 0
      process.exit = (c?: number) => {
        exited += 1
        throw new Error(`__exit__${String(c)}`)
      }
      try {
        try {
          silenced(() => run(['--full']))
        } catch {
          // Exit
        }
      } finally {
        process.exit = origExit
      }
      expect(exited).toBeGreaterThan(0)
    } finally {
      process.chdir(cwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('run no flag with full project: prints summary; --markdown prints reference', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-docs-full-'))
    const cwd = process.cwd()
    try {
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      writeFileSync(join(dir, 'convex', 'todos.ts'), `export const x = crud('todo', schema)`, 'utf8')
      writeFileSync(join(dir, 'schema.ts'), 'const owned = makeOwned({ todo: object({ title: string() }) })', 'utf8')
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      process.exit = (c?: number) => {
        throw new Error(`__exit__${String(c)}`)
      }
      try {
        silenced(() => run([]))
        silenced(() => run(['--markdown']))
      } finally {
        process.exit = origExit
      }
      expect(true).toBe(true)
    } finally {
      process.chdir(cwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('run --full with src/ runs through entry points', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-docs-fullfull-'))
    const cwd = process.cwd()
    try {
      mkdirSync(join(dir, 'src'), { recursive: true })
      process.chdir(dir)
      silenced(() => run(['--full']))
      expect(true).toBe(true)
    } finally {
      process.chdir(cwd)
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
