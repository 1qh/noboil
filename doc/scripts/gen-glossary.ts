#!/usr/bin/env bun
/* eslint-disable no-console */
import { readJson } from 'noboil/env-file'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, relative, resolve } from 'node:path'
import { collectBraceExports, DOCS_DIR, LIB_NOBOIL, PKG_JSON_PATH, REPO, STRIP_AUTOGEN_RE, STRIP_FENCE_RE } from './lib'

const EXPORT_DECL_RE = /export\s+(?:const|function|class|interface|type)\s+(?<name>\w+)/gu
const collectExports = (file: string): Set<string> => {
  const out = new Set<string>()
  // oxlint-disable-next-line node/no-sync
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
interface Entry {
  docs: string[]
  file: string
  subpaths: string[]
}
const indexSubpath = ({
  pkgName,
  sub,
  symToEntry,
  target
}: {
  pkgName: string
  sub: string
  symToEntry: Map<string, Entry>
  target: string | { default?: string; import?: string; types?: string }
}) => {
  const path = typeof target === 'string' ? target : (target.types ?? target.default ?? target.import ?? '')
  const abs = path ? resolve(LIB_NOBOIL, path) : ''
  // oxlint-disable-next-line node/no-sync
  if (abs && statSync(abs, { throwIfNoEntry: false })) {
    const subpath = sub === '.' ? pkgName : `${pkgName}/${sub.replace('./', '')}`
    for (const sym of collectExports(abs)) {
      const e = symToEntry.get(sym) ?? { docs: [], file: relative(REPO, abs), subpaths: [] }
      if (!e.subpaths.includes(subpath)) e.subpaths.push(subpath)
      symToEntry.set(sym, e)
    }
  }
}
const linkDocsFor = (docsDir: string, file: string, symToEntry: Map<string, Entry>) => {
  // oxlint-disable-next-line node/no-sync
  const src = readFileSync(`${docsDir}/${file}`, 'utf8').replaceAll(STRIP_AUTOGEN_RE, '').replaceAll(STRIP_FENCE_RE, '')
  const slug = basename(file, '.mdx')
  for (const [sym, entry] of symToEntry) {
    const re = new RegExp(`\\b${sym}\\b`, 'u')
    if (re.test(src) && !entry.docs.includes(slug)) entry.docs.push(slug)
  }
}
const main = () => {
  const pkg = readJson(PKG_JSON_PATH) as {
    exports: Record<string, string | { default?: string; import?: string; require?: string; types?: string }>
    name: string
  }
  const symToEntry = new Map<string, Entry>()
  for (const [sub, target] of Object.entries(pkg.exports)) indexSubpath({ pkgName: pkg.name, sub, symToEntry, target })
  const docsDir = DOCS_DIR
  // oxlint-disable-next-line node/no-sync
  for (const file of readdirSync(docsDir).toSorted())
    if (file.endsWith('.mdx') && file !== 'glossary.mdx') linkDocsFor(docsDir, file, symToEntry)
  const sorted = [...symToEntry.entries()].toSorted(([a], [b]) => a.localeCompare(b))
  const rows: string[] = []
  for (const [sym, e] of sorted) {
    const subs = e.subpaths.map(s => `\`${s}\``).join(', ')
    const refs = e.docs.length === 0 ? '_(undocumented)_' : e.docs.map(d => `[${d}](./${d})`).join(', ')
    rows.push(`| \`${sym}\` | ${subs} | \`${e.file}\` | ${refs} |`)
  }
  const body = [
    '---',
    'title: Glossary',
    'description: Every public export with its import path, source file, and pages mentioning it. Auto-generated.',
    '---',
    '',
    `Auto-generated index of every public export reachable through \`noboil/...\` subpaths. **${sorted.length} symbols.**`,
    '',
    'For an explanation of what each symbol does, follow the "Mentioned in" links — that is where the prose lives.',
    '',
    '| Symbol | Import paths | Source file | Mentioned in |',
    '|---|---|---|---|',
    ...rows
  ].join('\n')
  // oxlint-disable-next-line node/no-sync
  writeFileSync(`${docsDir}/glossary.mdx`, `${body}\n`)
  console.log(`Wrote glossary.mdx (${sorted.length} symbols)`)
}
main()
