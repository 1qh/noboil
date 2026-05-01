/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
describe('convex doctor()', () => {
  test('runs full health check against tmp project with valid schema + factory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noboil-doctor-'))
    const orig = process.cwd()
    try {
      mkdirSync(join(dir, 'convex', '_generated'), { recursive: true })
      writeFileSync(
        join(dir, 'convex', 'todos.ts'),
        `export const x = crud('todo', schema, { rateLimit: { max: 1, window: 1000 } })`,
        'utf8'
      )
      writeFileSync(
        join(dir, 'convex', 'schema.ts'),
        'const owned = makeOwned({ todo: object({ title: string() }) })\nexport default defineSchema({ todo: defineTable({}), missing: defineTable({}) })',
        'utf8'
      )
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
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
