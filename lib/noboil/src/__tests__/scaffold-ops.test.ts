import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  patchRootPackageJson,
  patchTsconfig,
  patchWorkspacePackageJsons,
  pruneLibFe,
  REMOVE_ALWAYS,
  removeDirs,
  rmSafe
} from '../scaffold-ops'

describe('scaffold-ops', () => {
  test('REMOVE_ALWAYS includes expected entries', () => {
    expect(REMOVE_ALWAYS).toContain('AGENTS.md')
    expect(REMOVE_ALWAYS).toContain('.github')
    expect(REMOVE_ALWAYS).toContain('doc')
  })
  test('rmSafe handles non-existent paths', () => {
    expect(() => rmSafe(join(tmpdir(), 'noboil-nonexistent-zzz-9999'))).not.toThrow()
  })
  test('rmSafe removes existing dir', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-rmsafe-'))
    expect(() => rmSafe(dir)).not.toThrow()
  })
  test('removeDirs deletes other DB + always-remove entries', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-rd-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'AGENTS.md'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'web', 'stdb'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'backend', 'spacetimedb'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'web', 'cvx'), { recursive: true })
      const removed = removeDirs({ db: 'convex', dir, includeDemos: true })
      expect(removed).toContain('AGENTS.md')
      expect(removed).toContain('web/stdb')
      expect(removed).toContain('backend/spacetimedb')
      expect(removed).not.toContain('web/cvx')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('removeDirs without demos also removes own demo dir', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-rd2-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'web', 'cvx'), { recursive: true })
      const removed = removeDirs({ db: 'convex', dir, includeDemos: false })
      expect(removed).toContain('web/cvx')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('patchRootPackageJson rewrites name + workspaces + scripts', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-pr-'))
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          dependencies: { '@a/foo': '1', convex: '1' },
          devDependencies: { '@a/bar': '1' },
          name: 'noboil',
          scripts: { 'dev:web': 'next dev', 'spacetime:dev': 'spacetime up', test: 'bun test' },
          workspaces: ['lib/*']
        })
      )
      patchRootPackageJson({ db: 'convex', dir, includeDemos: true })
      // oxlint-disable-next-line node/no-sync
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        dependencies: Record<string, string>
        name: string
        private: boolean
        scripts: Record<string, string>
        workspaces: string[]
      }
      expect(pkg.name).toBe('my-app')
      expect(pkg.private).toBe(true)
      expect(pkg.workspaces).toContain('web/cvx/*')
      expect(pkg.dependencies['@a/foo']).toBeUndefined()
      expect(pkg.dependencies.noboil).toBe('latest')
      expect(pkg.scripts['spacetime:dev']).toBeUndefined()
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('pruneLibFe removes other-db prefixed entries', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-pl-'))
    try {
      const feSrc = join(dir, 'lib', 'fe', 'src')
      // oxlint-disable-next-line node/no-sync
      mkdirSync(feSrc, { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(feSrc, 'spacetimedb-foo.ts'), 'export const x = 1')
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(feSrc, 'convex-bar.ts'), 'export const y = 1')
      pruneLibFe({ db: 'convex', dir })
      // oxlint-disable-next-line node/no-sync
      const left = readdirSync(feSrc)
      expect(left).not.toContain('spacetimedb-foo.ts')
      expect(left).toContain('convex-bar.ts')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('patchTsconfig + patchWorkspacePackageJsons no-throw smoke', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-pt-'))
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: { '@a/x': ['lib/x'] } } }))
      expect(() => {
        patchTsconfig({ db: 'convex', dir })
        patchWorkspacePackageJsons({ db: 'convex', dir })
      }).not.toThrow()
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('patchWorkspacePackageJsons strips other-db backend dep + lifts noboil workspace ref', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-pwspkg-'))
    try {
      // oxlint-disable-next-line node/no-sync
      mkdirSync(join(dir, 'lib', 'fe'), { recursive: true })
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'lib', 'fe', 'package.json'),
        JSON.stringify({
          dependencies: { '@a/be-spacetimedb': 'workspace:*', noboil: 'workspace:*', other: '1.0' },
          devDependencies: { '@a/be-spacetimedb': '1' },
          name: '@a/fe'
        }),
        'utf8'
      )
      patchWorkspacePackageJsons({ db: 'convex', dir })
      // oxlint-disable-next-line node/no-sync
      const after = JSON.parse(readFileSync(join(dir, 'lib', 'fe', 'package.json'), 'utf8')) as {
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
      }
      expect(after.dependencies['@a/be-spacetimedb']).toBeUndefined()
      expect(after.dependencies.noboil).toBe('latest')
      expect(after.devDependencies['@a/be-spacetimedb']).toBeUndefined()
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
  test('patchTsconfig adds custom condition for stdb db', () => {
    // oxlint-disable-next-line node/no-sync
    const dir = mkdtempSync(join(tmpdir(), 'noboil-pts-'))
    try {
      // oxlint-disable-next-line node/no-sync
      writeFileSync(
        join(dir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { customConditions: ['existing'] } }),
        'utf8'
      )
      patchTsconfig({ db: 'spacetimedb', dir })
      // oxlint-disable-next-line node/no-sync
      const ts = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8')) as {
        compilerOptions: { customConditions: string[] }
      }
      expect(ts.compilerOptions.customConditions).toContain('noboil-spacetimedb')
    } finally {
      // oxlint-disable-next-line node/no-sync
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
