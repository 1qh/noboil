import { config } from '@a/config'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { root, run } from './utils'
const args = process.argv.slice(2).join(' ')
const hashDir = (dir: string): string => {
  const h = createHash('sha256')
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'module_bindings') continue
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.ts') || e.name === 'package.json') {
        h.update(`${p}:`)
        h.update(readFileSync(p))
      }
    }
  }
  walk(dir)
  return h.digest('hex')
}
const cacheDir = join(root, '.cache', 'stdb-publish')
const cacheFile = join(cacheDir, 'last-hash')
const wantHash = hashDir(join(root, config.paths.backendStdb))
if (!args.includes('--force') && existsSync(cacheFile) && readFileSync(cacheFile, 'utf8') === wantHash) {
  // eslint-disable-next-line no-console
  console.log('stdb-publish: module unchanged, skipping')
  process.exit(0)
}
const sdkPath = join(root, 'node_modules', 'spacetimedb', 'dist', 'server', 'index.mjs')
const backupPath = `${sdkPath}.orig`
const patchedContent = existsSync(sdkPath) ? readFileSync(sdkPath, 'utf8') : ''
const wasPatched = patchedContent.includes('/* patched: stdb-sys-stub */')
if (wasPatched && existsSync(backupPath)) copyFileSync(backupPath, sdkPath)
try {
  await run(
    `bash -lc 'PATH="${root}/node_modules/.bin:$HOME/.local/bin:$PATH" spacetime publish ${config.module} --module-path ${config.paths.backendStdb} ${args}'`,
    { quiet: false }
  )
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile, wantHash)
} finally {
  if (wasPatched) writeFileSync(sdkPath, patchedContent)
}
