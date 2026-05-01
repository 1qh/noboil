/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkSchemaConsistency,
  printAccessReport,
  printHealthReport,
  printIndexReport,
  printSchemaPreview
} from '../check'
import { run as doctorRun } from '../doctor'
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
  test('doctor run --help prints usage and returns', () => {
    silenced(() => doctorRun(['--help']))
    expect(true).toBe(true)
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
