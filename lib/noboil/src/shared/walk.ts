import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSchemaFile } from './viz'
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
    if (!existsSync(dir)) return
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
  for (const candidate of STDB_MODULE_CANDIDATES(root))
    if (existsSync(candidate)) {
      const files = listTypeScriptFiles(candidate)
      for (const file of files) if (isSchemaFile(readFileSync(file, 'utf8'))) return candidate
    }
}
const findStdbModuleDirDeep = (root: string): string | undefined => {
  const direct = findStdbModuleDir(root)
  if (direct) return direct
  if (!existsSync(root)) return
  for (const sub of readdirSync(root, { withFileTypes: true }))
    if (sub.isDirectory()) {
      const nested = findStdbModuleDir(join(root, sub.name, 'module'))
      if (nested) return nested
    }
}
export { findStdbModuleDir, findStdbModuleDirDeep, isSourceTs, listTypeScriptFiles, walkFiles }
