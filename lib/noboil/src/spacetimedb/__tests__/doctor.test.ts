/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captured } from '../../shared/test'
import { doctor } from '../doctor'

const silenced = (fn: () => unknown) => {
  const orig = console.log
  console.log = () => undefined
  try {
    return fn()
  } finally {
    console.log = orig
  }
}
const runDoctor = (dir: string) => {
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
      silenced(() => doctor())
    } catch (error) {
      if (!(error instanceof Error) || error.message !== '__exit__') throw error
    } finally {
      process.exit = origExit
    }
    return exited
  } finally {
    process.chdir(orig)
  }
}
describe('stdb doctor()', () => {
  test('reports its index-coverage and dependency sections for a schema + reducers project', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-doc-warn-'))
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
        join(dir, 'reducers.ts'),
        `export const x = makeCrud({ tableName: 'todo', options: { where: { unindexed_field: 1 } } })`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ dependencies: { noboil: '1', spacetimedb: '1', zod: '4' } }),
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
        try {
          ;({ out } = captured(() => doctor()))
        } catch (error) {
          if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
        }
      } finally {
        process.exit = origExit
      }
      expect(out).toContain('Index Coverage')
      expect(out).toContain('Dependenc')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('exits when no schema file present', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-doc-empty-'))
    try {
      expect(runDoctor(dir)).toBeGreaterThan(0)
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('runs full health check against tmp project with valid schema + module', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-doctor-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'mod.ts'),
        'export default schema({ tables: { todo: table({ fields: { title: t.string() } }) } })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'reducers.ts'),
        `export const x = makeCrud({ tableName: 'todo', options: { rateLimit: { max: 1, window: 1000 } } })`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ dependencies: { noboil: '1', spacetimedb: '1', zod: '4' } }),
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
        ;({ out } = captured(() => doctor()))
      } catch (error) {
        if (!(error instanceof Error && error.message.startsWith('__exit__'))) throw error
      } finally {
        process.exit = origExit
      }
      expect(out).toContain('Reducer Coverage')
      expect(out).toContain('Summary:')
      expect(out).toContain('Health Score:')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
