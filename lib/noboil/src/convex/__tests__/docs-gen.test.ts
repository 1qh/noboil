import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateFullReference, generateMarkdown } from '../docs-gen'
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
