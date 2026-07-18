#!/usr/bin/env bun
/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween } from './lib'
// eslint-disable-next-line regexp/no-super-linear-backtracking, sonarjs/super-linear-regex -- scans trusted repo middleware source; bounded non-adversarial input
const MIDDLEWARE_RE = /(?:\/\*\*\s*(?<doc>[^*]+?)\s*\*\/\s*)?const (?<name>\w+) = \((?<args>[^)]*)\):\s*Middleware\b/gu
const escapeMd = (s: string): string =>
  s
    .replaceAll('|', String.raw`\|`)
    .replaceAll('{', String.raw`\{`)
    .replaceAll('}', String.raw`\}`)
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
interface MwInfo {
  args: string
  doc: string
  name: string
}
const extract = (src: string): MwInfo[] => {
  const out: MwInfo[] = []
  let m = MIDDLEWARE_RE.exec(src)
  while (m) {
    if (m.groups?.name)
      out.push({
        args: (m.groups.args ?? '').trim() || '()',
        doc: (m.groups.doc ?? '').replaceAll(/\s+/gu, ' ').trim(),
        name: m.groups.name
      })
    m = MIDDLEWARE_RE.exec(src)
  }
  MIDDLEWARE_RE.lastIndex = 0
  return out
}
const main = () => {
  // oxlint-disable-next-line node/no-sync
  const cvx = extract(readFileSync(`${LIB_NOBOIL}/src/convex/server/middleware.ts`, 'utf8'))
  // oxlint-disable-next-line node/no-sync
  const stdb = extract(readFileSync(`${LIB_NOBOIL}/src/spacetimedb/server/middleware.ts`, 'utf8'))
  const all = [...new Set([...cvx, ...stdb].map(mw => mw.name))].toSorted((a, b) => (a < b ? -1 : Number(a > b)))
  const infoByName = new Map<string, MwInfo>()
  for (const mw of [...cvx, ...stdb]) if (!infoByName.has(mw.name) || mw.doc) infoByName.set(mw.name, mw)
  const cvxNames = new Set(cvx.map(mw => mw.name))
  const stdbNames = new Set(stdb.map(mw => mw.name))
  const rows = all.map(name => {
    const info = infoByName.get(name)
    const args = info?.args ?? '()'
    const desc = info?.doc ? escapeMd(info.doc) : '_(no JSDoc)_'
    return `| \`${name}\` | \`${escapeMd(args)}\` | ${cvxNames.has(name) ? '✓' : '—'} | ${stdbNames.has(name) ? '✓' : '—'} | ${desc} |`
  })
  const body = [
    `**${all.length} middleware factories** (combine via \`middleware: [a(), b()]\` in \`noboil({ ... })\`). Description column auto-extracted from leading JSDoc.`,
    '',
    '| Factory | Options arg | Convex | SpacetimeDB | Description |',
    '|---|---|---|---|---|',
    ...rows
  ].join('\n')
  const target = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(target, 'MIDDLEWARE', body)
  console.log(dirty ? `Updated middleware reference (${all.length})` : `Middleware reference up to date (${all.length})`)
}
main()
