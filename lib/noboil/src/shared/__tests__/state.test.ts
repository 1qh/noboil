import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readState, writeState } from '../state'

describe('state (smoke)', () => {
  test('readState returns object', async () => {
    const s = await readState()
    expect(typeof s).toBe('object')
  })
  test('readState catches malformed state.json', async () => {
    const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    // oxlint-disable-next-line node/no-sync
    const fakeHome = mkdtempSync(join(tmpdir(), 'noboil-state-bad-'))
    const origHome = process.env.HOME
    try {
      process.env.HOME = fakeHome
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(fakeHome, '.noboil'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(fakeHome, '.noboil', 'state.json'), '{not valid json', 'utf8')
      const s = await readState()
      expect(typeof s).toBe('object')
    } finally {
      process.env.HOME = origHome
      // oxlint-disable-next-line node/no-sync
      rmSync(fakeHome, { force: true, recursive: true })
    }
  })
  test('writeState is idempotent', async () => {
    await writeState({ lastDb: 'convex' })
    const s = await readState()
    expect(['convex', 'spacetimedb', undefined]).toContain(s.lastDb)
  })
})
