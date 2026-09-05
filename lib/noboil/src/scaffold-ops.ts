/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { readJson, writeJson } from './shared/env-file'

type Db = 'convex' | 'spacetimedb'
interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  name?: string
  private?: boolean
  scripts?: Record<string, string>
  workspaces?: string[]
}
const REMOVE_ALWAYS = ['.github', 'AGENTS.md', 'doc', 'script/prep-publish.ts']
const rmSafe = (path: string) => {
  // oxlint-disable-next-line node/no-sync
  if (existsSync(path)) rmSync(path, { force: true, recursive: true })
}
const removeDirs = ({ db, dir, includeDemos }: { db: Db; dir: string; includeDemos: boolean }): string[] => {
  const dbTag = db === 'convex' ? 'cvx' : 'stdb'
  const otherTag = db === 'convex' ? 'stdb' : 'cvx'
  const otherDb = db === 'convex' ? 'spacetimedb' : 'convex'
  const toRemove = [...REMOVE_ALWAYS, `web/${otherTag}`, `backend/${otherDb}`, 'backend/agent', 'tool/cli']
  if (!includeDemos) toRemove.push(`web/${dbTag}`)
  const removed: string[] = []
  for (const p of toRemove) {
    const full = join(dir, p)
    // oxlint-disable-next-line node/no-sync
    if (existsSync(full)) {
      rmSafe(full)
      removed.push(p)
    }
  }
  return removed
}
const stripAScope = (section?: Record<string, string>): Record<string, string> | undefined => {
  if (!section) return
  const next: Record<string, string> = {}
  for (const [key, val] of Object.entries(section)) if (!key.startsWith('@a/')) next[key] = val
  return next
}
const patchRootPackageJson = ({ db, dir, includeDemos }: { db: Db; dir: string; includeDemos: boolean }) => {
  const pkgPath = join(dir, 'package.json')
  const pkg = readJson(pkgPath) as PackageJson
  const otherDb = db === 'convex' ? 'spacetimedb' : 'convex'
  const shouldDrop = (key: string, val: string) =>
    key === 'test' ||
    (db === 'spacetimedb' && key.includes('codegen')) ||
    (db === 'convex' && key.startsWith('spacetime:')) ||
    (!includeDemos && (key.startsWith('dev:') || key.startsWith('test:e2e'))) ||
    val.includes(otherDb)
  pkg.name = 'my-app'
  pkg.private = true
  const workspaces: string[] = ['lib/*', 'backend/*', 'readonly/*']
  if (includeDemos) workspaces.push(db === 'convex' ? 'web/cvx/*' : 'web/stdb/*')
  pkg.workspaces = workspaces
  if (pkg.scripts) {
    const keep: Record<string, string> = { test: 'echo "add tests"' }
    for (const [key, val] of Object.entries(pkg.scripts)) if (!shouldDrop(key, val)) keep[key] = val
    pkg.scripts = keep
  }
  const deps = stripAScope(pkg.dependencies) ?? {}
  deps.noboil = 'latest'
  pkg.dependencies = deps
  pkg.devDependencies = stripAScope(pkg.devDependencies)
  writeJson(pkgPath, pkg)
}
const pruneLibFe = ({ db, dir }: { db: Db; dir: string }) => {
  const feSrc = join(dir, 'lib', 'fe', 'src')
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(feSrc)) return
  const otherPrefix = db === 'convex' ? 'spacetimedb-' : 'convex-'
  // oxlint-disable-next-line node/no-sync
  for (const entry of readdirSync(feSrc)) if (entry.startsWith(otherPrefix)) rmSync(join(feSrc, entry))
}
const listChildPackages = (root: string): string[] => {
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(root)) return []
  const out: string[] = []
  // oxlint-disable-next-line node/no-sync
  for (const entry of readdirSync(root, { withFileTypes: true }))
    if (entry.isDirectory()) {
      const pkg = join(root, entry.name, 'package.json')
      // oxlint-disable-next-line node/no-sync
      if (existsSync(pkg)) out.push(pkg)
    }
  return out
}
const fixChildSection = (
  section: Record<string, string> | undefined,
  otherBeScope: string
): [Record<string, string> | undefined, boolean] => {
  if (!section) return [section, false]
  let changed = false
  const next: Record<string, string> = {}
  for (const [key, val] of Object.entries(section))
    if (key === otherBeScope) changed = true
    else if (key === 'noboil' && val === 'workspace:*') {
      next[key] = 'latest'
      changed = true
    } else next[key] = val
  return [next, changed]
}
const patchWorkspacePackageJsons = ({ db, dir }: { db: Db; dir: string }) => {
  const otherDb = db === 'convex' ? 'spacetimedb' : 'convex'
  const otherBeScope = `@a/be-${otherDb}`
  const pkgs = [
    ...listChildPackages(join(dir, 'lib')),
    ...listChildPackages(join(dir, 'backend')),
    ...listChildPackages(join(dir, 'readonly'))
  ]
  for (const pkgPath of pkgs) {
    const pkg = readJson(pkgPath) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    const [deps, a] = fixChildSection(pkg.dependencies, otherBeScope)
    const [devDeps, b] = fixChildSection(pkg.devDependencies, otherBeScope)
    const [peerDeps, c] = fixChildSection(pkg.peerDependencies, otherBeScope)
    if (a || b || c) {
      pkg.dependencies = deps
      pkg.devDependencies = devDeps
      pkg.peerDependencies = peerDeps
      writeJson(pkgPath, pkg)
    }
  }
}
const patchTsconfig = ({ db, dir }: { db: Db; dir: string }) => {
  if (db === 'convex') return
  const tsconfigPath = join(dir, 'tsconfig.json')
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(tsconfigPath)) return
  const tsconfig = readJson(tsconfigPath) as {
    compilerOptions?: { customConditions?: string[] }
  }
  tsconfig.compilerOptions ??= {}
  const existing = tsconfig.compilerOptions.customConditions ?? []
  const condition = `noboil-${db}`
  if (!existing.includes(condition)) tsconfig.compilerOptions.customConditions = [...existing, condition]
  writeJson(tsconfigPath, tsconfig)
}
export type { Db, PackageJson }
export { patchRootPackageJson, patchTsconfig, patchWorkspacePackageJsons, pruneLibFe, REMOVE_ALWAYS, removeDirs, rmSafe }
