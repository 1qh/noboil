import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateFullReference, generateMarkdown } from '../docs-gen'
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
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-fullref-'))
    try {
      const md = generateFullReference(dir)
      expect(md).toContain('# noboil/spacetimedb')
      expect(md).toContain('exports')
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
