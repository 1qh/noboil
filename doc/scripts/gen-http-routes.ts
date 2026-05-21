#!/usr/bin/env bun
/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { DOCS_DIR, replaceBetween, REPO } from './lib'

const ROUTE_RE = /http\.route\(\{[\s\S]*?method:\s*'(?<method>[A-Z]+)',\s*path:\s*'(?<path>[^']+)'/gu
const main = () => {
  const src = readFileSync(`${REPO}/backend/convex/convex/http.ts`, 'utf8')
  const routes: { method: string; path: string }[] = []
  let m = ROUTE_RE.exec(src)
  while (m) {
    if (m.groups?.method && m.groups.path) routes.push({ method: m.groups.method, path: m.groups.path })
    m = ROUTE_RE.exec(src)
  }
  ROUTE_RE.lastIndex = 0
  const sorted = routes.toSorted((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
  const rows = sorted.map(r => `| \`${r.method}\` | \`${r.path}\` |`)
  const body = [
    `**${routes.length} explicit \`http.route(...)\` registrations** in \`backend/convex/convex/http.ts\` (plus auth routes added by \`auth.addHttpRoutes(http)\` not enumerated here).`,
    '',
    '| Method | Path |',
    '|---|---|',
    ...rows
  ].join('\n')
  const target = `${DOCS_DIR}/api-reference.mdx`
  const dirty = replaceBetween(target, 'HTTP-ROUTES', body)
  console.log(dirty ? `Updated HTTP routes (${routes.length})` : 'HTTP routes up to date')
}
main()
