#!/usr/bin/env bun
/* eslint-disable no-console */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DOCS_DIR } from './lib'

const MDX_EXT_RE = /\.mdx$/u
const META = `${DOCS_DIR}/meta.json`
const ORDER = [
  'index',
  'quickstart',
  'architecture',
  'differences',
  'cli',
  'components',
  'data-fetching',
  'forms',
  'file-uploads',
  'organizations',
  'owned',
  'orgScoped',
  'child',
  'singleton',
  'base',
  'log',
  'kv',
  'quota',
  'composing-mutations',
  'gradual-adoption',
  'security',
  'devtools',
  'testing',
  'schema-evolution',
  'api-reference',
  'custom-queries',
  'recipes',
  'migration',
  'ejecting',
  'deployment',
  'troubleshooting',
  'glossary',
  'single-source-of-truth'
]
const main = () => {
  const onDisk = new Set(
    // oxlint-disable-next-line node/no-sync
    readdirSync(DOCS_DIR)
      .toSorted()
      .filter(f => f.endsWith('.mdx'))
      .map(f => f.replace(MDX_EXT_RE, ''))
  )
  const ordered: string[] = []
  for (const slug of ORDER) if (onDisk.has(slug)) ordered.push(slug)
  for (const slug of [...onDisk].toSorted()) if (!ordered.includes(slug)) ordered.push(slug)
  const missing = ORDER.filter(s => !onDisk.has(s))
  if (missing.length > 0) console.warn(`  ⚠ Listed in ORDER but missing on disk: ${missing.join(', ')}`)
  const next: { pages: string[]; title: string } = { pages: ordered, title: 'Documentation' }
  // oxlint-disable-next-line node/no-sync
  const current = readFileSync(META, 'utf8')
  const nextStr = `${JSON.stringify(next, null, 2)}\n`
  if (current === nextStr) {
    console.log(`Meta nav up to date (${ordered.length} pages)`)
    return
  }
  if (process.argv.includes('--check')) {
    console.log('Updated meta.json (drift)')
    return
  }
  // oxlint-disable-next-line node/no-sync
  writeFileSync(META, nextStr)
  const before = (JSON.parse(current) as { pages: string[] }).pages.length
  console.log(`Updated meta.json (${ordered.length} pages, +${ordered.length - before})`)
}
main()
