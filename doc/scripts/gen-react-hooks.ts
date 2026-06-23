#!/usr/bin/env bun
/* eslint-disable no-console */
import { existsSync, readdirSync } from 'node:fs'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween } from './lib'

const hooksFor = (kind: 'convex' | 'spacetimedb'): string[] => {
  const dir = `${LIB_NOBOIL}/src/${kind}/react`
  // oxlint-disable-next-line node/no-sync
  return readdirSync(dir)
    .toSorted()
    .filter(f => f.startsWith('use-') && f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => `use${f.slice(4, -3).replaceAll(/-./gu, m => m[1]?.toUpperCase() ?? '')}`)
    .toSorted()
}
const main = () => {
  const cvx = hooksFor('convex')
  const stdb = hooksFor('spacetimedb')
  const all = [...new Set([...cvx, ...stdb])].toSorted()
  const rows = all.map(hook => {
    const inCvx = cvx.includes(hook)
    const inStdb = stdb.includes(hook)
    return `| \`${hook}\` | ${inCvx ? '✓' : '—'} | ${inStdb ? '✓' : '—'} |`
  })
  const body = ['| Hook | Convex | SpacetimeDB |', '|---|---|---|', ...rows].join('\n')
  const target = `${DOCS_DIR}/api-reference.mdx`
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(target)) throw new Error(`missing ${target}`)
  const dirty = replaceBetween(target, 'REACT-HOOKS', body)
  console.log(
    dirty
      ? `Updated react hooks list (cvx:${cvx.length}, stdb:${stdb.length}, total:${all.length})`
      : `React hooks list up to date (cvx:${cvx.length}, stdb:${stdb.length}, total:${all.length})`
  )
}
main()
