/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
const runDoctorExpectExit = (dir: string) => {
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
const runDoctorCaptured = (dir: string): string => {
  const orig = process.cwd()
  try {
    process.chdir(dir)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const origExit = process.exit
    process.exit = () => {
      throw new Error('__exit__')
    }
    try {
      return captured(() => doctor()).out
    } catch (error) {
      if (error instanceof Error && error.message === '__exit__') return ''
      throw error
    } finally {
      process.exit = origExit
    }
  } finally {
    process.chdir(orig)
  }
}
describe('convex doctor()', () => {
  test('clean project hits all-matched + indexes warn branches', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-doc-clean-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'convex', 'todos.ts'),
        `export const x = crud('todo', schema, { rateLimit: { max: 1, window: 1000 }, where: { unindexed_field: 1 } })`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'schema.ts'),
        'const owned = makeOwned({ todo: object({ title: string() }) })\nexport default defineSchema({ todo: defineTable({}) })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ dependencies: { convex: '1', noboil: '1', zod: '4' } }),
        'utf8'
      )
      const out = runDoctorCaptured(dir)
      expect(out).toContain('Summary:')
      expect(out).toContain('Health Score:')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('exits when no convex/_generated dir', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-doc-empty-'))
    try {
      expect(runDoctorExpectExit(dir)).toBeGreaterThan(0)
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('exits when convex dir exists but no schema file with markers', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-doc-noschema-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'plain.ts'), 'export const x = 1', 'utf8')
      expect(runDoctorExpectExit(dir)).toBeGreaterThan(0)
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('finds nested convex dir via subdirectory recursion', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-doc-sub-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'app', 'convex', '_generated'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'app', 'schema.ts'),
        'const owned = makeOwned({ todo: object({ title: string() }) })\nexport default defineSchema({ todo: defineTable({}) })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'app', 'convex', 'todos.ts'),
        `export const x = crud('todo', schema, { rateLimit: { max: 1, window: 1000 } })`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ dependencies: { convex: '1', noboil: '1', zod: '4' } }),
        'utf8'
      )
      const out = runDoctorCaptured(dir)
      expect(out).toContain('Summary:')
      expect(out).toContain('Health Score:')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('runs full health check against tmp project with valid schema + factory', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-doctor-'))
    const orig = process.cwd()
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'convex', 'todos.ts'),
        `export const x = crud('todo', schema, { rateLimit: { max: 1, window: 1000 } })`,
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'convex', 'schema.ts'),
        'const owned = makeOwned({ todo: object({ title: string() }) })\nexport default defineSchema({ todo: defineTable({}), missing: defineTable({}) })',
        'utf8'
      )
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ dependencies: { convex: '1', noboil: '1', zod: '4' } }),
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
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
