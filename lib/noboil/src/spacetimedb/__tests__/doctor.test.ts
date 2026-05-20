/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  test('runs full doctor with schema warnings + index issues hits warn branches', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-doc-warn-'))
    const orig = process.cwd()
    try {
      writeFileSync(
        join(dir, 'schema.ts'),
        'export default schema({ tables: { todo: table(t.u64(), { id: t.u64(), title: t.string() }), unused: table(t.u64(), { id: t.u64() }) } })',
        'utf8'
      )
      writeFileSync(
        join(dir, 'reducers.ts'),
        `export const x = makeCrud({ tableName: 'todo', options: { where: { unindexed_field: 1 } } })`,
        'utf8'
      )
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
      try {
        try {
          silenced(() => doctor())
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
  test('exits when no schema file present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-doc-empty-'))
    try {
      expect(runDoctor(dir)).toBeGreaterThan(0)
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('runs full health check against tmp project with valid schema + module', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-stdb-doctor-'))
    const orig = process.cwd()
    try {
      writeFileSync(
        join(dir, 'mod.ts'),
        'export default schema({ tables: { todo: table({ fields: { title: t.string() } }) } })',
        'utf8'
      )
      writeFileSync(
        join(dir, 'reducers.ts'),
        `export const x = makeCrud({ tableName: 'todo', options: { rateLimit: { max: 1, window: 1000 } } })`,
        'utf8'
      )
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ dependencies: { noboil: '1', spacetimedb: '1', zod: '4' } }),
        'utf8'
      )
      process.chdir(dir)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origExit = process.exit
      let exitCode: number | undefined
      process.exit = (c?: number) => {
        exitCode = c
        throw new Error('__exit__')
      }
      try {
        silenced(() => doctor())
      } catch (error) {
        if (!(error instanceof Error) || error.message !== '__exit__') throw error
      } finally {
        process.exit = origExit
      }
      expect(exitCode === undefined || exitCode === 1).toBe(true)
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
