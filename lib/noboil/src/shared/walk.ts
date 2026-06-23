import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isSchemaFile } from './viz'

const findAncestorFile = (start: string, name: string, maxDepth = 10): null | string => {
  let dir = resolve(start)
  for (let i = 0; i < maxDepth; i += 1) {
    const candidate = join(dir, name)
    // oxlint-disable-next-line node/no-sync
    if (existsSync(candidate)) return candidate
    const parent = resolve(dir, '..')
    if (parent === dir) return null
    dir = parent
  }
  return null
}
const DEFAULT_SKIP = new Set(['.git', '.next', '.turbo', 'build', 'dist', 'node_modules'])
interface WalkOpts {
  accept?: (name: string) => boolean
  skip?: Set<string>
}
const walkFiles = (root: string, opts: WalkOpts = {}): string[] => {
  const skip = opts.skip ?? DEFAULT_SKIP
  const accept = opts.accept ?? (() => true)
  const out: string[] = []
  const walk = (dir: string) => {
    // oxlint-disable-next-line node/no-sync
    if (!existsSync(dir)) return
    // oxlint-disable-next-line node/no-sync
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!(skip.has(entry.name) || entry.name.startsWith('.'))) walk(full)
      } else if (accept(entry.name)) out.push(full)
    }
  }
  walk(root)
  return out
}
const isSourceTs = (name: string): boolean =>
  name.endsWith('.ts') && !name.includes('.test.') && !name.includes('.config.')
const listTypeScriptFiles = (root: string): string[] => walkFiles(root, { accept: isSourceTs })
const STDB_MODULE_CANDIDATES = (root: string): string[] => [
  root,
  join(root, 'module'),
  join(root, 'src', 'module'),
  join(root, 'src'),
  join(root, 'backend', 'spacetimedb', 'src')
]
const findStdbModuleDir = (root: string): string | undefined => {
  for (const candidate of STDB_MODULE_CANDIDATES(root)) {
    // oxlint-disable-next-line node/no-sync
    const exists = existsSync(candidate)
    if (exists) {
      const files = listTypeScriptFiles(candidate)
      for (const file of files) {
        // oxlint-disable-next-line node/no-sync
        const content = readFileSync(file, 'utf8')
        if (isSchemaFile(content)) return candidate
      }
    }
  }
}
const findStdbModuleDirDeep = (root: string): string | undefined => {
  const direct = findStdbModuleDir(root)
  if (direct) return direct
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(root)) return
  // oxlint-disable-next-line node/no-sync
  for (const sub of readdirSync(root, { withFileTypes: true }))
    if (sub.isDirectory()) {
      const nested = findStdbModuleDir(join(root, sub.name, 'module'))
      if (nested) return nested
    }
}
export { findAncestorFile, findStdbModuleDir, findStdbModuleDirDeep, isSourceTs, listTypeScriptFiles, walkFiles }
