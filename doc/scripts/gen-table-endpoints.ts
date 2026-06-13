#!/usr/bin/env bun
/* eslint-disable no-console */
import { readdirSync, readFileSync } from 'node:fs'
import { DOCS_DIR, replaceBetween, REPO } from './lib'

const EXPORT_BLOCK_RE = /export\s*\{(?<syms>[^}]+)\}/u
const main = () => {
  const dir = `${REPO}/backend/convex/convex`
  const rows: string[] = []
  let totalEndpoints = 0
  let tableCount = 0
  for (const f of readdirSync(dir).toSorted()) {
    const skip = !f.endsWith('.ts') || f.startsWith('_') || f === 'schema.ts' || f === 'http.ts' || f === 'auth.ts'
    if (!skip) {
      const src = readFileSync(`${dir}/${f}`, 'utf8')
      const m = EXPORT_BLOCK_RE.exec(src)
      const names =
        m?.groups?.syms
          ?.split(',')
          .map(s => s.trim())
          .filter(s => s && s !== 'type')
          .toSorted() ?? []
      if (names.length > 0) {
        tableCount += 1
        totalEndpoints += names.length
        const table = f.slice(0, -'.ts'.length)
        rows.push(`| \`${table}\` | ${names.length} | ${names.map(n => `\`${n}\``).join(', ')} |`)
      }
    }
  }
  const body = [
    `**${totalEndpoints} endpoints across ${tableCount} table modules** in \`backend/convex/convex/\`. Each row is a re-export aggregator combining factory-generated CRUD + custom \`pq\`/\`q\`/\`m\` builders.`,
    '',
    '| Module | Count | Endpoints |',
    '|---|--:|---|',
    ...rows
  ].join('\n')
  const target = `${DOCS_DIR}/api-reference.mdx`
  const dirty = replaceBetween(target, 'TABLE-ENDPOINTS', body)
  console.log(dirty ? `Updated table endpoints (${totalEndpoints} across ${tableCount})` : 'Table endpoints up to date')
}
main()
