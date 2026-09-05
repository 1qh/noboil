#!/usr/bin/env bun
/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { DOCS_DIR, replaceBetween, REPO } from './lib'
// eslint-disable-next-line sonarjs/super-linear-regex -- scans trusted repo backend source; bounded non-adversarial input
const TABLE_RE = /(?<name>\w+):\s*table\(s\.\w+(?:,\s*\{(?<opts>[\s\S]*?)\}\s*\))?/gu
const KNOWN_OPTS = [
  'rateLimit',
  'search',
  'softDelete',
  'pub',
  'acl',
  'aclFrom',
  'cascade',
  'key',
  'unique',
  'ttl',
  'staleWhileRevalidate'
] as const
type Opt = (typeof KNOWN_OPTS)[number]
const parse = (src: string): Map<string, Set<Opt>> => {
  const result = new Map<string, Set<Opt>>()
  let m = TABLE_RE.exec(src)
  while (m) {
    if (m.groups?.name) {
      const opts = m.groups.opts ?? ''
      const set = new Set<Opt>()
      for (const o of KNOWN_OPTS) if (opts.includes(`${o}:`)) set.add(o)
      result.set(m.groups.name, set)
    }
    m = TABLE_RE.exec(src)
  }
  TABLE_RE.lastIndex = 0
  return result
}
const main = () => {
  // oxlint-disable-next-line node/no-sync
  const cvx = parse(readFileSync(`${REPO}/backend/convex/lazy.ts`, 'utf8'))
  // oxlint-disable-next-line node/no-sync
  const stdb = parse(readFileSync(`${REPO}/backend/spacetimedb/src/index.ts`, 'utf8'))
  const counts: Record<Opt, { cvx: string[]; stdb: string[] }> = Object.fromEntries(
    KNOWN_OPTS.map(o => [o, { cvx: [] as string[], stdb: [] as string[] }])
  ) as Record<Opt, { cvx: string[]; stdb: string[] }>
  for (const [name, set] of cvx) for (const o of set) counts[o].cvx.push(name)
  for (const [name, set] of stdb) for (const o of set) counts[o].stdb.push(name)
  const rows = KNOWN_OPTS.map(o => {
    const c = counts[o].cvx.toSorted((a, b) => (a < b ? -1 : Number(a > b)))
    const s = counts[o].stdb.toSorted((a, b) => (a < b ? -1 : Number(a > b)))
    const cWhere = c.length === 0 ? '—' : c.map(t => `\`${t}\``).join(', ')
    const sWhere = s.length === 0 ? '—' : s.map(t => `\`${t}\``).join(', ')
    return `| \`${o}\` | ${c.length} | ${s.length} | ${cWhere} | ${sWhere} |`
  })
  const body = [
    `**${KNOWN_OPTS.length} known table options** scanned across both backend lazy.ts files. Numbers are how many tables enable each option.`,
    '',
    '| Option | cvx tables | stdb tables | Where (cvx) | Where (stdb) |',
    '|---|--:|--:|---|---|',
    ...rows
  ].join('\n')
  const target = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(target, 'OPTIONS-INVENTORY', body)
  console.log(dirty ? `Updated options inventory (${KNOWN_OPTS.length} options)` : 'Options inventory up to date')
}
main()
