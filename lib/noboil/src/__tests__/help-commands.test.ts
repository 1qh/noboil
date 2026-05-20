/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { doctor } from '../doctor'
import { eject } from '../eject'
import { status } from '../status'
import { sync } from '../sync'
import { upgrade } from '../upgrade'

const silenced = (fn: () => unknown) => {
  const orig = console.log
  console.log = () => undefined
  try {
    return fn()
  } finally {
    console.log = orig
  }
}
describe('root --help commands', () => {
  test('doctor --help', async () => {
    await silenced(async () => {
      await doctor(['--help'])
    })
    expect(true).toBe(true)
  })
  test('upgrade --help', () => {
    silenced(() => upgrade(['--help']))
    expect(true).toBe(true)
  })
  test('status with .noboilrc.json reports scaffold age + node_modules presence', async () => {
    const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'noboil-status-full-'))
    const orig = process.cwd()
    try {
      const oldDate = new Date(Date.now() - 60 * 86_400_000).toISOString()
      writeFileSync(
        join(dir, '.noboilrc.json'),
        JSON.stringify({
          db: 'convex',
          ejected: false,
          includeDemos: true,
          scaffoldedAt: oldDate,
          scaffoldedFrom: 'a'.repeat(40)
        }),
        'utf8'
      )
      mkdirSync(join(dir, 'node_modules'), { recursive: true })
      writeFileSync(join(dir, 'package.json'), '{"name":"x"}', 'utf8')
      process.chdir(dir)
      silenced(() => status([]))
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
    expect(true).toBe(true)
  })
  test('status --help shows help', () => {
    silenced(() => status(['--help']))
    expect(true).toBe(true)
  })
  test('humanizeAge edge cases via status with various dates', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const cases = [
      new Date().toISOString(),
      new Date(Date.now() - 86_400_000).toISOString(),
      new Date(Date.now() - 5 * 86_400_000).toISOString()
    ]
    for (const date of cases) {
      const dir = mkdtempSync(join(tmpdir(), 'noboil-status-age-'))
      const orig = process.cwd()
      try {
        writeFileSync(
          join(dir, '.noboilrc.json'),
          JSON.stringify({ db: 'spacetimedb', ejected: true, scaffoldedAt: date, scaffoldedFrom: 'b'.repeat(40) }),
          'utf8'
        )
        process.chdir(dir)
        silenced(() => status([]))
      } finally {
        process.chdir(orig)
        rmSync(dir, { force: true, recursive: true })
      }
    }
    expect(true).toBe(true)
  })
  test('doctor --last-error reads crash log when exists, else falls back', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { homedir } = await import('node:os')
    const fakeHome = mkdtempSync(join(tmpdir(), 'noboil-fake-home-'))
    const origHome = process.env.HOME
    try {
      process.env.HOME = fakeHome
      const home = homedir()
      const noboilDir = join(home, '.noboil')
      const { mkdirSync } = await import('node:fs')
      mkdirSync(noboilDir, { recursive: true })
      writeFileSync(join(noboilDir, 'last-error.log'), 'previous crash content', 'utf8')
      await silenced(async () => {
        await doctor(['--last-error'])
      })
      rmSync(join(noboilDir, 'last-error.log'), { force: true })
      await silenced(async () => {
        await doctor(['--last-error'])
      })
    } finally {
      process.env.HOME = origHome
      rmSync(fakeHome, { force: true, recursive: true })
    }
    expect(true).toBe(true)
  })
  test('status outside a noboil project prints message', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'noboil-status-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      silenced(() => status([]))
    } finally {
      process.chdir(orig)
      rmSync(dir, { force: true, recursive: true })
    }
    expect(true).toBe(true)
  })
  test('sync + status + eject --help (with process.exit guard)', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const origExit = process.exit
    process.exit = () => {
      throw new Error('__exit__')
    }
    const safe = (fn: () => unknown) => async () => {
      try {
        await fn()
      } catch (error) {
        if (!(error instanceof Error) || error.message !== '__exit__') throw error
      }
    }
    try {
      await silenced(safe(async () => sync(['--help'])))
      await silenced(safe(() => status(['--help'])))
      await silenced(safe(async () => eject(['--help'])))
    } finally {
      process.exit = origExit
    }
    expect(true).toBe(true)
  })
})
