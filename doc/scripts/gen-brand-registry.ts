#!/usr/bin/env bun
/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween } from './lib'

const TYPES_PATH = `${LIB_NOBOIL}/src/convex/server/types.ts`
const ENTRY_RE = /(?<brand>\w+):\s*'(?<hint>[^']+)'/u
const main = () => {
  // oxlint-disable-next-line node/no-sync
  const src = readFileSync(TYPES_PATH, 'utf8')
  const lines = src.split('\n')
  let inBlock = false
  const rows: string[] = []
  for (const line of lines)
    if (line.includes('interface SchemaHintMap')) inBlock = true
    else if (inBlock) {
      if (line.trim() === '}') break
      const m = ENTRY_RE.exec(line)
      if (m?.groups?.brand && m.groups.hint) {
        const safeHint = m.groups.hint.replaceAll('{', String.raw`\{`).replaceAll('}', String.raw`\}`)
        rows.push(`| \`${m.groups.brand}\` | ${safeHint} |`)
      }
    }
  rows.sort()
  const table = ['| Brand | Maker → Factory + Wrapper |', '|---|---|', ...rows].join('\n')
  const target = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(target, 'BRAND-REGISTRY', table)
  console.log(
    dirty ? `Updated brand registry (${rows.length} entries)` : `Brand registry up to date (${rows.length} entries)`
  )
}
main()
