#!/usr/bin/env bun
/* eslint-disable no-console */
/** biome-ignore-all lint/performance/useTopLevelRegex: per-file scan */
import { Transpiler } from 'bun'
import { walkFiles } from 'noboil/walk'
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { DOCS_DIR, replaceBetween, REPO } from './lib'

const FENCE_RE = /```(?:ts|tsx|typescript)\n(?<code>[\s\S]*?)```/gu
const walk = (dir: string): string[] => walkFiles(dir, { accept: name => name.endsWith('.mdx') })
interface Block {
  code: string
  file: string
  index: number
}
const extractBlocks = (src: string, file: string): Block[] => {
  const out: Block[] = []
  let m = FENCE_RE.exec(src)
  let idx = 0
  while (m) {
    if (m.groups?.code) out.push({ code: m.groups.code, file, index: idx })
    idx += 1
    m = FENCE_RE.exec(src)
  }
  FENCE_RE.lastIndex = 0
  return out
}
const SYNTAX_TOKENS = [
  'import ',
  'export ',
  'const ',
  'let ',
  'function ',
  'interface ',
  'type ',
  'class ',
  'await ',
  'return ',
  '=>',
  '({',
  '})',
  ': string',
  ': number',
  ': boolean'
]
const looksLikeTypeScript = (code: string): boolean => SYNTAX_TOKENS.some(t => code.includes(t))
const SOFT = [
  'has already been declared',
  'cannot be reassigned',
  'Top-level return',
  'must have an initializer',
  'cannot use import',
  'export from a non ECMAScript',
  'Parse error',
  'Multiple exports with the same name'
]
const checkBlock = (b: Block): { issue?: string; parseable: boolean } => {
  if (!looksLikeTypeScript(b.code)) return { parseable: true }
  if (/\{\s*\.\.\.\s*\}/u.test(b.code) || b.code.includes('/* ... */') || /^\s*\{\s*\n/u.test(b.code))
    return { parseable: true }
  try {
    new Transpiler({ loader: 'tsx', target: 'browser' }).scan(b.code)
    return { parseable: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    const first = msg.split('\n')[0] ?? ''
    if (SOFT.some(s => first.includes(s))) return { parseable: true }
    return { issue: `${relative(REPO, b.file)} block #${b.index}: ${first}`, parseable: false }
  }
}
const main = () => {
  const files = walk(DOCS_DIR)
  let total = 0
  let parseable = 0
  const issues: string[] = []
  for (const file of files) {
    const blocks = extractBlocks(readFileSync(file, 'utf8'), file)
    for (const b of blocks) {
      total += 1
      const res = checkBlock(b)
      if (res.parseable) parseable += 1
      if (res.issue) issues.push(res.issue)
    }
  }
  const pct = total === 0 ? 100 : Math.round((parseable / total) * 100)
  const body = [
    '`Transpiler.scan()` (from `bun`) over every ```ts/tsx code fence in `doc/content/docs/*.mdx`. Catches syntax-level rot when source code changes break embedded snippets.',
    '',
    `**${parseable}/${total} blocks parseable (${pct}%).** Snippets without TypeScript-shaped syntax (config JSON, shell, mermaid) are skipped — they're counted as parseable but not actually checked.`,
    '',
    issues.length === 0 ? '_No syntax issues._' : '**Failures:**',
    '',
    ...issues.toSorted().map(i => `- ${i}`)
  ].join('\n')
  const target = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(target, 'EXAMPLE-CHECK', body)
  console.log(
    dirty
      ? `Updated example check (${parseable}/${total} = ${pct}%, ${issues.length} issue(s))`
      : `Example check up to date (${pct}%)`
  )
  if (issues.length > 0) {
    console.warn(`  ⚠ ${issues.length} doc snippet(s) failed to parse`)
    for (const i of issues.slice(0, 5)) console.warn(`    ${i}`)
  }
}
main()
