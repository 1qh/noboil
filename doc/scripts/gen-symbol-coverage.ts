#!/usr/bin/env bun
/** biome-ignore-all lint/performance/useTopLevelRegex: per-file scan */
/** biome-ignore-all lint/nursery/noContinue: walker */
/* eslint-disable no-console, no-continue */
import { readJson } from 'noboil/env-file'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { collectBraceExports, DOCS_DIR, LIB_NOBOIL, PKG_JSON_PATH, replaceBetween } from './lib'

const EXPORT_DECL_RE = /export\s+(?:const|function|class|interface|type)\s+(?<name>\w+)/gu
const collectExports = (file: string): Set<string> => {
  const out = new Set<string>()
  const src = readFileSync(file, 'utf8')
  collectBraceExports(src, out)
  let dm = EXPORT_DECL_RE.exec(src)
  while (dm) {
    if (dm.groups?.name) out.add(dm.groups.name)
    dm = EXPORT_DECL_RE.exec(src)
  }
  EXPORT_DECL_RE.lastIndex = 0
  return out
}
const STRIP_RE =
  /\{\/\* AUTO-GENERATED:SYMBOL-COVERAGE:START \*\/\}[\s\S]*?\{\/\* AUTO-GENERATED:SYMBOL-COVERAGE:END \*\/\}/gu
const collectDocsText = (root: string): string => {
  let combined = ''
  for (const f of readdirSync(root).toSorted()) if (f.endsWith('.mdx')) combined += readFileSync(`${root}/${f}`, 'utf8')
  return combined.replaceAll(STRIP_RE, '')
}
const main = () => {
  const pkg = readJson(PKG_JSON_PATH) as {
    exports: Record<string, string | { default?: string; import?: string; require?: string; types?: string }>
  }
  const publicExports = new Set<string>()
  for (const [, target] of Object.entries(pkg.exports)) {
    const path = typeof target === 'string' ? target : (target.types ?? target.default ?? target.import ?? '')
    if (!path) continue
    const abs = resolve(LIB_NOBOIL, path)
    if (statSync(abs, { throwIfNoEntry: false })) for (const sym of collectExports(abs)) publicExports.add(sym)
  }
  const docsText = collectDocsText(DOCS_DIR)
  const documented: string[] = []
  const undocumented: string[] = []
  for (const sym of [...publicExports].toSorted()) {
    const re = new RegExp(`\\b${sym}\\b`, 'u')
    if (re.test(docsText)) documented.push(sym)
    else undocumented.push(sym)
  }
  const pct = publicExports.size === 0 ? 0 : Math.round((documented.length / publicExports.size) * 100)
  const undocSample = undocumented.slice(0, 50)
  const body = [
    `Coverage of public exports (every name reachable through \`noboil/...\` subpaths) by mention in \`doc/content/docs/*.mdx\`. **${documented.length}/${publicExports.size} mentioned (${pct}%).**`,
    '',
    `Undocumented (first ${undocSample.length} of ${undocumented.length}):`,
    '',
    undocSample.length === 0 ? '_(none — full coverage)_' : undocSample.map(s => `\`${s}\``).join(', ')
  ].join('\n')
  const target = `${DOCS_DIR}/api-reference.mdx`
  const dirty = replaceBetween(target, 'SYMBOL-COVERAGE', body)
  console.log(dirty ? `Updated symbol coverage (${pct}%)` : `Symbol coverage up to date (${pct}%)`)
}
main()
