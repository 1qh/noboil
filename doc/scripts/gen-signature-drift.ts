#!/usr/bin/env bun
/* eslint-disable no-console */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween, REPO } from './lib'

interface Hook {
  args: string
  file: string
  name: string
}
const HOOK_RE = /const (?<name>use[A-Z]\w*)\s*=\s*(?:<[^>]+>\s*)?\(/gu
const ARG_NAME_RE = /[\s:]/u
const balancedParens = (src: string, openIdx: number): string => {
  let depth = 1
  let i = openIdx + 1
  while (i < src.length && depth > 0) {
    if (src[i] === '(') depth += 1
    else if (src[i] === ')') depth -= 1
    i += 1
  }
  return src.slice(openIdx + 1, i - 1)
}
const collectHooksFromFile = (root: string, f: string, out: Hook[]) => {
  // oxlint-disable-next-line node/no-sync
  const src = readFileSync(`${root}/${f}`, 'utf8')
  let m = HOOK_RE.exec(src)
  while (m) {
    const openIdx = m.groups?.name ? src.indexOf('(', m.index + m[0].length - 1) : -1
    if (m.groups?.name && openIdx !== -1) {
      const params = balancedParens(src, openIdx).replaceAll(/\s+/gu, ' ').trim()
      out.push({ args: params || '', file: relative(REPO, `${root}/${f}`), name: m.groups.name })
    }
    m = HOOK_RE.exec(src)
  }
  HOOK_RE.lastIndex = 0
}
const collectHooks = (root: string): Hook[] => {
  const out: Hook[] = []
  // oxlint-disable-next-line node/no-sync
  if (!statSync(root, { throwIfNoEntry: false })) return out
  // oxlint-disable-next-line node/no-sync
  for (const f of readdirSync(root).toSorted((a, b) => (a < b ? -1 : Number(a > b))))
    if (f.startsWith('use-') && f.endsWith('.ts') && !f.endsWith('.test.ts')) collectHooksFromFile(root, f, out)
  return out
}
const walkDocs = (dir: string, out: string[] = []): string[] => {
  // oxlint-disable-next-line node/no-sync
  for (const name of readdirSync(dir).toSorted((a, b) => (a < b ? -1 : Number(a > b))))
    if (!name.startsWith('.')) {
      const full = join(dir, name)
      // oxlint-disable-next-line node/no-sync
      if (statSync(full).isDirectory()) walkDocs(full, out)
      else if (name.endsWith('.mdx')) out.push(full)
    }
  return out
}
const main = () => {
  const sources = [
    ...collectHooks(`${LIB_NOBOIL}/src/convex/react`),
    ...collectHooks(`${LIB_NOBOIL}/src/spacetimedb/react`)
  ]
  const docFiles = walkDocs(DOCS_DIR)
  // oxlint-disable-next-line node/no-sync
  const allDocText = docFiles.map(f => readFileSync(f, 'utf8')).join('\n')
  const issues: string[] = []
  let mentioned = 0
  let withDecl = 0
  let drift = 0
  for (const hook of sources) {
    const re = new RegExp(`\\b${hook.name}\\b`, 'u')
    if (re.test(allDocText)) {
      mentioned += 1
      const declRe = new RegExp(`(?:const|function)\\s+${hook.name}\\s*=?\\s*(?:<[^>]+>)?\\s*\\(([^)]{0,300})\\)`, 'gu')
      let dm = declRe.exec(allDocText)
      while (dm) {
        withDecl += 1
        const docArgs = (dm[1] ?? '').trim()
        const docFirst = docArgs.split(',')[0]?.trim() ?? ''
        const srcFirst = hook.args.split(',')[0]?.trim() ?? ''
        const docName = docFirst.split(ARG_NAME_RE)[0] ?? ''
        const srcName = srcFirst.split(ARG_NAME_RE)[0] ?? ''
        if (docName && srcName && docName !== srcName) {
          drift += 1
          issues.push(`\`${hook.name}\`: doc declaration shows first arg \`${docName}\`, source has \`${srcName}\``)
        }
        dm = declRe.exec(allDocText)
      }
    }
  }
  const total = sources.length
  const body = [
    'Compares first argument names of every `useXxx(...)` call appearing in docs to the actual hook signature in `lib/noboil/src/{convex,spacetimedb}/react/use-*.ts`. Catches a common kind of doc rot.',
    '',
    `**${mentioned}/${total} hooks mentioned in docs.** Of those, ${withDecl} have at least one \`const useX = (...)\`-style declaration in a code fence. **${drift} drift mismatches.**`,
    '',
    issues.length === 0 ? '_No drift detected._' : '**Drift:**',
    '',
    ...issues.map(i => `- ${i}`)
  ].join('\n')
  const archTarget = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(archTarget, 'SIGNATURE-DRIFT', body)
  console.log(
    dirty ? `Updated signature drift (${drift} mismatch(es) across ${mentioned} hooks)` : 'Signature drift up to date'
  )
}
main()
