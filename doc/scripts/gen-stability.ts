#!/usr/bin/env bun
/* eslint-disable no-console, max-depth */
import { walkFiles } from 'noboil/walk'
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween, REPO } from './lib'

const TAGS = ['@beta', '@alpha', '@experimental', '@deprecated', '@internal'] as const
type Tag = (typeof TAGS)[number]
const walk = (dir: string): string[] =>
  walkFiles(dir, {
    accept: name => (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.test.ts'),
    skip: new Set(['__tests__', 'node_modules'])
  })
const SYM_RE = /(?:export\s+)?(?:const|function|class|interface|type)\s+(?<name>\w+)/u
const main = () => {
  const root = `${LIB_NOBOIL}/src`
  const files = walk(root)
  let symbols = 0
  const tagged: { file: string; reason: string; symbol: string; tag: Tag }[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? ''
      const sm = SYM_RE.exec(line)
      if (sm?.groups) symbols += 1
      for (const tag of TAGS)
        if (line.includes(tag))
          for (let j = i; j < Math.min(i + 8, lines.length); j += 1) {
            const sym = SYM_RE.exec(lines[j] ?? '')
            if (sym?.groups) {
              const reason = (line.split(tag)[1] ?? '').replaceAll('*/', '').replaceAll('*', '').trim() || '_(no reason)_'
              const symbolName = sym.groups.name ?? ''
              tagged.push({ file: relative(REPO, file), reason, symbol: symbolName, tag })
              break
            }
          }
    }
  }
  const counts: Record<Tag, number> = { '@alpha': 0, '@beta': 0, '@deprecated': 0, '@experimental': 0, '@internal': 0 }
  for (const t of tagged) counts[t.tag] += 1
  const summaryLine = `Scanned **${files.length} files**, **${symbols} declared symbols**. ${
    tagged.length === 0
      ? 'No `@beta`/`@alpha`/`@experimental`/`@deprecated`/`@internal` JSDoc tags found — entire public surface is **stable**.'
      : ''
  }`
  const lines: string[] = [summaryLine, '']
  if (tagged.length > 0) {
    lines.push(
      `**Tag counts:** ${Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([t, n]) => `${t}: ${n}`)
        .join(', ')}`,
      '',
      '| Symbol | Tag | File | Reason |',
      '|---|---|---|---|'
    )
    for (const t of tagged.toSorted((a, b) => a.tag.localeCompare(b.tag) || a.symbol.localeCompare(b.symbol)))
      lines.push(`| \`${t.symbol}\` | \`${t.tag}\` | \`${t.file}\` | ${t.reason} |`)
  } else
    lines.push(
      'To mark API stability, add JSDoc tags above an export:',
      '',
      '```ts',
      '/** @beta New shape, may change without major version bump. */',
      'export const someExperiment = () => 42',
      '```',
      '',
      'This generator picks them up automatically.'
    )

  const body = lines.join('\n')
  const target = `${DOCS_DIR}/api-reference.mdx`
  const dirty = replaceBetween(target, 'STABILITY', body)
  console.log(
    dirty ? `Updated stability table (${tagged.length} tagged of ${symbols} symbols)` : 'Stability table up to date'
  )
}
main()
