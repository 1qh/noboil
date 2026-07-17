import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { doctor } from '../doctor'
import { eject } from '../eject'
import { captured, capturedAsync } from '../shared/test'
import { status } from '../status'
import { sync } from '../sync'
import { upgrade } from '../upgrade'

describe('root --help commands', () => {
  test('doctor --help prints its usage and options', async () => {
    const { out } = await capturedAsync(async () => doctor(['--help']))
    expect(out).toContain('noboil doctor')
    expect(out).toContain('Usage:')
    expect(out).toContain('--last-error')
  })
  test('upgrade --help prints its usage', () => {
    const { out } = captured(() => upgrade(['--help']))
    expect(out).toContain('noboil upgrade')
    expect(out).toContain('Usage:')
  })
  test('status with .noboilrc.json reports scaffold age + node_modules presence', async () => {
    const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-status-full-'))
    const orig = process.cwd()
    try {
      const oldDate = new Date(Date.now() - 60 * 86_400_000).toISOString()
      // oxlint-disable-next-line node/no-sync
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
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'node_modules'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'package.json'), '{"name":"x"}', 'utf8')
      process.chdir(dir)
      const { out } = captured(() => status([]))
      expect(out).toContain('convex')
      expect(out).toContain('aaaaaaa')
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('status --help prints its usage', () => {
    const { out } = captured(() => status(['--help']))
    expect(out).toContain('noboil status')
    expect(out).toContain('Usage:')
  })
  test('status reports each scaffold age it is given', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const cases = [
      new Date().toISOString(),
      new Date(Date.now() - 86_400_000).toISOString(),
      new Date(Date.now() - 5 * 86_400_000).toISOString()
    ]
    const statusInTempDirWithScaffoldDate = (date: string): string => {
      // oxlint-disable-next-line node/no-sync
      const dir = mkdtempSync(join(tmpdir(), 'noboil-status-age-'))
      const orig = process.cwd()
      try {
        // oxlint-disable-next-line node/no-sync
        writeFileSync(
          join(dir, '.noboilrc.json'),
          JSON.stringify({ db: 'spacetimedb', ejected: true, scaffoldedAt: date, scaffoldedFrom: 'b'.repeat(40) }),
          'utf8'
        )
        process.chdir(dir)
        return captured(() => status([])).out
      } finally {
        process.chdir(orig)
        // oxlint-disable-next-line node/no-sync
        rmSync(dir, { force: true, recursive: true })
      }
    }
    for (const date of cases) expect(statusInTempDirWithScaffoldDate(date)).toContain('spacetimedb')
  })
  test('doctor --last-error prints the crash log, and says so when there is none', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { homedir } = await import('node:os')
    // oxlint-disable-next-line node/no-sync
    const fakeHome = mkdtempSync(join(tmpdir(), 'noboil-fake-home-'))
    const origHome = process.env.HOME
    try {
      process.env.HOME = fakeHome
      const noboilDir = join(homedir(), '.noboil')
      const { mkdirSync } = await import('node:fs')
      // oxlint-disable-next-line node/no-sync
      mkdirSync(noboilDir, { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(noboilDir, 'last-error.log'), 'previous crash content', 'utf8')
      const withLog = await capturedAsync(async () => doctor(['--last-error']))
      expect(withLog.out).toContain('previous crash content')
      // oxlint-disable-next-line node/no-sync
      rmSync(join(noboilDir, 'last-error.log'), { force: true })
      const withoutLog = await capturedAsync(async () => doctor(['--last-error']))
      expect(withoutLog.out).not.toContain('previous crash content')
      expect(withoutLog.out.length).toBeGreaterThan(0)
    } finally {
      process.env.HOME = origHome
      // oxlint-disable-next-line node/no-sync
      rmSync(fakeHome, { force: true, recursive: true })
    }
  })
  test('status outside a noboil project prints a message', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-status-'))
    const orig = process.cwd()
    try {
      process.chdir(dir)
      const { out } = captured(() => status([]))
      expect(out.length).toBeGreaterThan(0)
    } finally {
      process.chdir(orig)
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('sync + eject --help print their usage (with process.exit guard)', async () => {
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
      const syncOut = await capturedAsync(safe(async () => sync(['--help'])))
      expect(syncOut.out).toContain('Usage:')
      const ejectOut = await capturedAsync(safe(async () => eject(['--help'])))
      expect(ejectOut.out).toContain('Usage:')
    } finally {
      process.exit = origExit
    }
  })
})
