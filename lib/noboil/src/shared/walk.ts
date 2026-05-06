import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
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
export { isSourceTs, listTypeScriptFiles, walkFiles }
