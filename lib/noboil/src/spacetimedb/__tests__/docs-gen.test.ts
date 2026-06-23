import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateFullReference, generateMarkdown, run } from '../docs-gen'

describe('stdb docs-gen', () => {
  test('generateMarkdown with empty calls produces header', () => {
    const md = generateMarkdown([], new Map())
    expect(md).toContain('# API Reference')
  })
  test('generateMarkdown with calls + table fields', () => {
    const calls = [{ factory: 'crud', file: 'todos.ts', options: '', table: 'todo' }]
    const fields = new Map([['todo', [{ name: 'title', type: 'string' }]]])
    const md = generateMarkdown(calls, fields)
    expect(md).toContain('todo')
    expect(md).toContain('### Schema Fields')
  })
  test('generateFullReference returns header for empty src dir', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-fullref-'))
    try {
      const md = generateFullReference(dir)
      expect(md).toContain('# noboil/spacetimedb')
      expect(md).toContain('exports')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('run() CLI dispatch covers --full no-src, full project, --markdown', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-docs-'))
    const cwd = process.cwd()
    /* eslint-disable no-console, @typescript-eslint/unbound-method */
    const origLog = console.log
    const origExit = process.exit
    try {
      process.chdir(dir)
      console.log = () => undefined
      let exited = 0
      process.exit = (c?: number) => {
        exited += 1
        throw new Error(`__exit__${String(c)}`)
      }
      try {
        try {
          run(['--full'])
        } catch {
          // Exit no src
        }
        try {
          run([])
        } catch {
          // Exit no module
        }
      } finally {
        // Continue with files written
      }
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'module'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'module', 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'module', 'reducers.ts'), `export const x = makeCrud({ tableName: 'todo' })`, 'utf8')
      try {
        run([])
        run(['--markdown'])
      } catch {
        // Ignore
      }
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'src'), { recursive: true })
      try {
        run(['--full'])
      } catch {
        // Ignore
      }
      expect(exited).toBeGreaterThan(0)
    } finally {
      process.chdir(cwd)
      console.log = origLog
      process.exit = origExit
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
    /* eslint-enable no-console, @typescript-eslint/unbound-method */
  })
})
