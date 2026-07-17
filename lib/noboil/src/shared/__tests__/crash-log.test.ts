import { file } from 'bun'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LOG_PATH, logCrash } from '../crash-log'

let dir = ''
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'noboil-crash-'))
  process.env.NOBOIL_CACHE_DIR = dir
})
afterAll(async () => {
  await rm(dir, { force: true, recursive: true })
})
describe('crash-log', () => {
  test('LOG_PATH resolves under the configured .noboil dir', () => {
    expect(LOG_PATH()).toBe(join(dir, '.noboil', 'last-error.log'))
  })
  test('logCrash writes the stack, argv and cwd for an Error', async () => {
    await rm(LOG_PATH(), { force: true })
    await logCrash(new Error('boom'))
    const written = await file(LOG_PATH()).text()
    expect(written).toContain('boom')
    expect(written).toContain(`cwd: ${process.cwd()}`)
  })
  test('logCrash writes a non-Error value verbatim', async () => {
    await rm(LOG_PATH(), { force: true })
    await logCrash('plain string error')
    expect(await file(LOG_PATH()).text()).toContain('plain string error')
  })
})
