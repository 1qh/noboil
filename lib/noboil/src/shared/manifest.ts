import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readJsonSafe } from './env-file'

interface Manifest {
  db?: 'convex' | 'spacetimedb'
  ejected?: boolean
  includeDemos?: boolean
  scaffoldedAt?: string
  scaffoldedFrom?: string
  version?: number
}
/** Walk up from `start` (max 10 levels) looking for `.noboilrc.json`; returns absolute path or null. */
const findManifestPath = (start: string): null | string => {
  let dir = start
  for (let i = 0; i < 10; i += 1) {
    const p = join(dir, '.noboilrc.json')
    if (existsSync(p)) return p
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return null
}
/** Find + parse `.noboilrc.json` from `start`. Returns `{ manifest, path }` or null on missing/malformed. */
const readManifestFrom = (start: string): null | { manifest: Manifest; path: string } => {
  const path = findManifestPath(start)
  if (!path) return null
  const manifest = readJsonSafe(path) as Manifest | null
  return manifest ? { manifest, path } : null
}
export type { Manifest }
export { findManifestPath, readManifestFrom }
