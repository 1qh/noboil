import { config } from '@a/config'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { root, run } from './utils'
const args = process.argv.slice(2).join(' ')
const isSkipDir = (name: string): boolean => name.startsWith('.') || name === 'node_modules' || name === 'module_bindings'
const isHashableFile = (name: string): boolean => name.endsWith('.ts') || name === 'package.json'
const hashDir = (dir: string): string => {
  const h = createHash('sha256')
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true }))
      if (isSkipDir(e.name)) {
        // Skip
      } else {
        const p = join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (isHashableFile(e.name)) {
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
const shouldSkip = !args.includes('--force') && existsSync(cacheFile) && readFileSync(cacheFile, 'utf8') === wantHash
const publishIfChanged = async () => {
  if (shouldSkip) {
    // eslint-disable-next-line no-console
    console.log('stdb-publish: module unchanged, skipping')
    return
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
}
await publishIfChanged()
