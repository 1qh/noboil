#!/usr/bin/env bun
/* eslint-disable no-console */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween, REPO } from './lib'

const ENV_RE = /process\.env\.(?<name>[A-Z][A-Z0-9_]+)/gu
const walk = (dir: string, out: string[] = []): string[] => {
  // oxlint-disable-next-line node/no-sync
  for (const name of readdirSync(dir).toSorted()) {
    const skip =
      name.startsWith('.') ||
      name === 'node_modules' ||
      name === 'dist' ||
      name === '_generated' ||
      name === 'module_bindings' ||
      name === '__tests__'
    const full = join(dir, name)
    // oxlint-disable-next-line node/no-sync
    const stat = statSync(full, { throwIfNoEntry: false })
    if (!skip && stat)
      if (stat.isDirectory())
        // oxlint-disable-next-line node/no-sync
        walk(full, out)
      else if ((name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.test.ts')) out.push(full)
  }
  return out
}
const main = () => {
  const root = `${LIB_NOBOIL}/src`
  const files = walk(root)
  const usage = new Map<string, Set<string>>()
  for (const file of files) {
    // oxlint-disable-next-line node/no-sync
    const src = readFileSync(file, 'utf8')
    let m = ENV_RE.exec(src)
    while (m) {
      if (m.groups?.name) {
        const set = usage.get(m.groups.name) ?? new Set<string>()
        set.add(relative(REPO, file))
        usage.set(m.groups.name, set)
      }
      m = ENV_RE.exec(src)
    }
    ENV_RE.lastIndex = 0
  }
  const names = [...usage.keys()].toSorted()
  const rows = names.map(n => {
    const files2 = [...(usage.get(n) ?? [])].toSorted()
    return `| \`${n}\` | ${files2.length} | ${files2.map(f => `\`${f}\``).join(', ')} |`
  })
  const body = [
    `**${names.length} environment variables read** by \`lib/noboil/src/\` (excluding tests). Set these in your project's \`.env\` / runtime config.`,
    '',
    '| Var | Files | Where |',
    '|---|--:|---|',
    ...rows
  ].join('\n')
  const target = `${DOCS_DIR}/deployment.mdx`
  const dirty = replaceBetween(target, 'ENV-VARS', body)
  console.log(dirty ? `Updated env vars (${names.length})` : `Env vars up to date (${names.length})`)
}
main()
