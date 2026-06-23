#!/usr/bin/env bun
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
const patchReact = (path: string): void => {
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(path)) return
  // oxlint-disable-next-line node/no-sync
  const content = readFileSync(path, 'utf8')
  if (content.includes(REACT_MARKER)) return
  const fixed = content
    .replaceAll(
      '}, [querySql, connectionState.isActive, connectionState]);',
      `}, [querySql, connectionState.isActive]);${REACT_MARKER}`
    )
    .replaceAll(
      /\[\s*connectionState,\s*accessorName,\s*querySql,\s*computeSnapshot,\s*callbacks\?\.onDelete,\s*callbacks\?\.onInsert,\s*callbacks\?\.onUpdate\s*\]/gu,
      '[connectionState.isActive, accessorName, querySql, computeSnapshot, callbacks?.onDelete, callbacks?.onInsert, callbacks?.onUpdate]'
    )
    .replaceAll(
      '}, [connectionState, accessorName, querySql, subscribeApplied]);',
      '}, [connectionState.isActive, accessorName, querySql, subscribeApplied]);'
    )
  if (fixed === content) return
  // oxlint-disable-next-line node/no-sync
  writeFileSync(path, fixed)
  console.log('patched useTable deps in', path)
}
for (const rel of REACT_VARIANTS) patchReact(join(import.meta.dir, '..', 'node_modules', 'spacetimedb', rel))
