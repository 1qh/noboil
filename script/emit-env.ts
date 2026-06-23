/* eslint-disable no-empty */
import { config, infraVars, portVars, urlVars } from '@a/config'
import { existsSync, lstatSync, readdirSync, symlinkSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { patchEnv, root } from './utils'

interface Target {
  depth: number
  dir: string
  web?: boolean
}
const lstatSafe = (p: string) => {
  try {
    // oxlint-disable-next-line node/no-sync
    return lstatSync(p)
  } catch {
    return null
  }
}
const relink = (link: string, target: string) => {
  // oxlint-disable-next-line node/no-sync
  if (existsSync(link) || lstatSafe(link))
    try {
      // oxlint-disable-next-line node/no-sync
      unlinkSync(link)
    } catch {
      // ignore unlink failures; symlink recreated below
    }
  // oxlint-disable-next-line node/no-sync
  symlinkSync(target, link)
}
const linkAppEnvs = () => {
  const targets: Target[] = []
  for (const kind of ['cvx', 'stdb'] as const) {
    const parent = join(root, kind === 'cvx' ? config.paths.webCvx : config.paths.webStdb)
    // oxlint-disable-next-line node/no-sync
    if (existsSync(parent))
      // oxlint-disable-next-line node/no-sync
      for (const name of readdirSync(parent)) {
        const d = join(parent, name)
        // oxlint-disable-next-line node/no-sync
        if (existsSync(join(d, 'package.json'))) targets.push({ depth: 3, dir: d, web: true })
      }
  }
  const docDir = join(root, config.paths.doc)
  // oxlint-disable-next-line node/no-sync
  if (existsSync(join(docDir, 'package.json'))) targets.push({ depth: 1, dir: docDir, web: true })
  for (const p of [config.paths.backendConvex, config.paths.backendStdb]) {
    const d = join(root, p)
    // oxlint-disable-next-line node/no-sync
    if (existsSync(join(d, 'package.json'))) targets.push({ depth: 2, dir: d })
  }
  for (const { depth, dir, web } of targets) {
    relink(join(dir, '.env'), `${'../'.repeat(depth)}.env`)
    if (web) relink(join(dir, 'dev.ts'), `${'../'.repeat(depth)}script/dev-app.ts`)
  }
}
const emit = () => {
  const entries = [...Object.entries(portVars()), ...Object.entries(infraVars()), ...Object.entries(urlVars())].map(
    ([k, v]) => [k, v] as [string, string]
  )
  patchEnv(entries)
  linkAppEnvs()
}
if (import.meta.main) emit()
export { emit }
