import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

setDefaultTimeout(40_000)
const BIN = join(import.meta.dir, '..', 'index.ts')
describe('noboil doctor --fix', () => {
  const dir = join(tmpdir(), `noboil-doctor-fix-${Date.now()}`)
  beforeEach(() => {
    // oxlint-disable-next-line node/no-sync
    mkdirSync(dir, { recursive: true })
    // oxlint-disable-next-line node/no-sync
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { noboil: 'latest' }, name: 'test-project' }))
    // oxlint-disable-next-line node/no-sync
    writeFileSync(
      join(dir, '.noboilrc.json'),
      JSON.stringify({
        db: 'spacetimedb',
        includeDemos: false,
        scaffoldedAt: new Date().toISOString(),
        scaffoldedFrom: 'abc1234',
        version: 1
      })
    )
    // oxlint-disable-next-line node/no-sync
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }))
  })
  afterEach(() => {
    // oxlint-disable-next-line node/no-sync
    rmSync(dir, { force: true, recursive: true })
  })
  test('--fix patches tsconfig customConditions once', () => {
    // oxlint-disable-next-line node/no-sync
    spawnSync('bun', [BIN, 'doctor', '--fix'], { cwd: dir, encoding: 'utf8', timeout: 15_000 }) // eslint-disable-line sonarjs/no-os-command-from-path -- test invokes trusted bin by name
    // oxlint-disable-next-line node/no-sync
    const first = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8')) as {
      compilerOptions?: { customConditions?: string[] }
    }
    const firstConds = first.compilerOptions?.customConditions ?? []
    expect(firstConds.filter(c => c === 'noboil-spacetimedb')).toHaveLength(1)
    // oxlint-disable-next-line node/no-sync
    spawnSync('bun', [BIN, 'doctor', '--fix'], { cwd: dir, encoding: 'utf8', timeout: 15_000 }) // eslint-disable-line sonarjs/no-os-command-from-path -- test invokes trusted bin by name
    // oxlint-disable-next-line node/no-sync
    const second = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8')) as {
      compilerOptions?: { customConditions?: string[] }
    }
    const secondConds = second.compilerOptions?.customConditions ?? []
    expect(secondConds.filter(c => c === 'noboil-spacetimedb')).toHaveLength(1)
  })
})
