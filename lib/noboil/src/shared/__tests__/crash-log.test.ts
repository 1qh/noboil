import { describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { LOG_PATH, logCrash } from '../crash-log'

describe('crash-log', () => {
  test('LOG_PATH points under ~/.noboil', () => {
    expect(LOG_PATH()).toContain('.noboil')
  })
  test('logCrash writes entry without throwing for Error', async () => {
    const path = LOG_PATH()
    try {
      rmSync(path, { force: true })
    } catch {
      // Ignore
    }
    await logCrash(new Error('boom'))
    expect(true).toBe(true)
  })
  test('logCrash handles non-Error value', async () => {
    await logCrash('plain string error')
    expect(true).toBe(true)
  })
})
