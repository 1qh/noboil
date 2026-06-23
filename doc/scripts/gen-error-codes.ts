#!/usr/bin/env bun
/* eslint-disable no-console */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ERROR_CODE_MEANINGS } from '../../lib/noboil/src/shared/error-codes'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween } from './lib'

const PATTERNS = [
  /\b(?:err|cvErr|throwErr)\(\s*'(?<code>[A-Z][A-Z_0-9]+)'/gu,
  /throw\s+new\s+\w*Error\(\s*'(?<code>[A-Z][A-Z_0-9]+)'/gu,
  /new\s+ConvexError\(\s*\{\s*code:\s*'(?<code>[A-Z][A-Z_0-9]+)'/gu,
  /throwConvexError\(\s*'(?<code>[A-Z][A-Z_0-9]+)'/gu
]
const walk = (dir: string, out: string[] = []): string[] => {
  // oxlint-disable-next-line node/no-sync
  for (const name of readdirSync(dir).toSorted()) {
    const full = join(dir, name)
    // oxlint-disable-next-line node/no-sync
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full)
  }
  return out
}
const main = () => {
  const files = [
    ...walk(`${LIB_NOBOIL}/src/convex/server`),
    ...walk(`${LIB_NOBOIL}/src/spacetimedb/server`),
    ...walk(`${LIB_NOBOIL}/src/shared`)
  ]
  const codes = new Set<string>()
  for (const file of files) {
    // oxlint-disable-next-line node/no-sync
    const src = readFileSync(file, 'utf8')
    for (const re of PATTERNS) {
      let m = re.exec(src)
      while (m) {
        if (m.groups?.code) codes.add(m.groups.code)
        m = re.exec(src)
      }
    }
  }
  const sorted = [...codes].toSorted()
  const body = [
    '| Code | Meaning |',
    '|------|---------|',
    ...sorted.map(
      c =>
        `| \`${c}\` | ${ERROR_CODE_MEANINGS[c] ?? '_(no description registered — add to lib/noboil/src/shared/error-codes.ts)_'} |`
    )
  ].join('\n')
  const undescribed = sorted.filter(c => !ERROR_CODE_MEANINGS[c])
  if (undescribed.length > 0) console.warn(`  ⚠ ${undescribed.length} codes missing meanings: ${undescribed.join(', ')}`)
  const target = `${DOCS_DIR}/api-reference.mdx`
  const dirty = replaceBetween(target, 'ERROR-CODES', body)
  console.log(dirty ? `Updated error codes (${sorted.length} codes)` : `Error codes up to date (${sorted.length} codes)`)
}
main()
