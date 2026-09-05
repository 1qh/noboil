#!/usr/bin/env bun
/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/* eslint-disable no-console */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const target = join(import.meta.dir, '..', 'node_modules', 'spacetimedb', 'dist', 'server', 'index.mjs')
const backup = `${target}.orig`
const marker = '/* patched: stdb-sys-stub */'
const VAR_SYS_RE = /^var sys = \{ (?:\.\.\._syscalls\d+_\d+(?:, )?)+ \};\n?/mu
const patchServer = (): void => {
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(target)) return
  // oxlint-disable-next-line node/no-sync
  const src = readFileSync(target, 'utf8')
  if (src.includes(marker)) return
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(backup)) copyFileSync(target, backup)
  const stub = `${marker}
const _noop = function () {}
const moduleHooks = Symbol('moduleHooks')
const sys = new Proxy({}, { get: () => _noop })
`
  const patched = src
    .replaceAll(/^import (?:\* as _syscalls\d+_\d+|\{ moduleHooks \}) from 'spacetime:sys@\d+\.\d+';\n?/gmu, '')
    .replace(VAR_SYS_RE, '')
  // oxlint-disable-next-line node/no-sync
  writeFileSync(target, stub + patched)
  console.log('patched', target)
}
patchServer()
const REACT_VARIANTS = ['dist/react/index.mjs', 'dist/browser/react/index.mjs']
const REACT_MARKER = '/* patched: useTable-deps */'
const DEP_ARRAY_RE = /\}, \[(?<deps>[^\]]*)\]\);/gu
/** The whole point of the patch: a hook that depends on the `connectionState` OBJECT re-runs on every identity change, so it re-subscribes constantly; only `isActive` should drive it. Expressed as a rule over any dep array rather than as the exact arrays this SDK happened to emit — upstream adding one entry (`enabled`) is enough to make a literal match miss, and a missed match here is invisible. */
const withStableConnectionDep = (content: string): { count: number; patched: string } => {
  let count = 0
  const patched = content.replaceAll(DEP_ARRAY_RE, (whole: string, ...rest: unknown[]) => {
    const groups = rest.at(-1) as undefined | { deps: string }
    const deps = (groups?.deps ?? '')
      .split(',')
      .map(d => d.trim())
      .filter(Boolean)
    if (!deps.includes('connectionState')) return whole
    count += 1
    const next = [...new Set(deps.map(d => (d === 'connectionState' ? 'connectionState.isActive' : d)))]
    return `}, [${next.join(', ')}]);`
  })
  return { count, patched }
}
const patchReact = (path: string): boolean => {
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(path)) return false
  // oxlint-disable-next-line node/no-sync
  const content = readFileSync(path, 'utf8')
  if (content.includes(REACT_MARKER)) return true
  const { count, patched } = withStableConnectionDep(content)
  if (count === 0)
    throw new Error(
      `no dep array in ${path} carries a bare connectionState — this patch is doing nothing, so either the SDK fixed it upstream (delete this) or its shape moved (re-derive it)`
    )
  // oxlint-disable-next-line node/no-sync
  writeFileSync(path, `${REACT_MARKER}\n${patched}`)
  console.log(`patched ${String(count)} useTable dep arrays in`, path)
  return true
}
const reactPatched = REACT_VARIANTS.map(rel => patchReact(join(import.meta.dir, '..', 'node_modules', 'spacetimedb', rel)))
if (!reactPatched.includes(true))
  throw new Error(
    `none of the spacetimedb react entrypoints exist (${REACT_VARIANTS.join(', ')}) — the patch reached nothing`
  )
