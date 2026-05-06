#!/usr/bin/env bun
/* eslint-disable no-console */
/* oxlint-disable unicorn/prefer-top-level-await */
import { $ } from 'bun'
import { walkFiles } from 'noboil/walk'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { replaceLineBetween, stripComments } from './lib'
const REPO = resolve(import.meta.dir, '../..')
const PASS_RE = /(?<pass>\d+)\s+pass/u
const TEST_CALL_RE = /(?:^|[\s;,([])(?:test|it)(?:\.skip|\.only|\.each\(.+?\))?\s*\(/gu
const runFullCount = async (cwd: string): Promise<number> => {
  const proc = await $`bun test`.cwd(cwd).quiet().nothrow()
  const out = (proc.stdout.toString() + proc.stderr.toString()).split('\n')
  for (const line of out) {
    const m = PASS_RE.exec(line)
    if (m?.groups?.pass) return Number(m.groups.pass)
  }
  return 0
}
const walkE2E = (root: string): string[] => walkFiles(root, { accept: name => name.endsWith('.test.ts') })
const countE2EFile = (path: string): number => {
  const src = stripComments(readFileSync(path, 'utf8'))
  return [...src.matchAll(TEST_CALL_RE)].length
}
const countE2EApp = (appDir: string): number => {
  const e2eDir = join(appDir, 'e2e')
  let total = 0
  for (const f of walkE2E(e2eDir)) total += countE2EFile(f)
  return total
}
const main = async () => {
  console.log('Counting tests (this takes ~30s)...')
  const [unit, integration] = await Promise.all([
    runFullCount(`${REPO}/lib/noboil`),
    runFullCount(`${REPO}/backend/convex`)
  ])
  const e2eApps: string[] = []
  for (const kind of ['cvx', 'stdb']) {
    const root = join(REPO, 'web', kind)
    if (statSync(root, { throwIfNoEntry: false })?.isDirectory())
      for (const app of readdirSync(root).toSorted()) e2eApps.push(join(root, app))
  }
  const e2eCounts = e2eApps
    .map(d => ({ count: countE2EApp(d), name: `${d.split('/web/').at(1)}` }))
    .filter(x => x.count > 0)
  const e2eTotal = e2eCounts.reduce((s, x) => s + x.count, 0)
  const e2eBreakdown = e2eCounts.map(x => `${x.count} ${x.name}`).join(', ')
  const total = unit + integration + e2eTotal
  const summary = `${total} tests — ${unit} unit + ${integration} integration + ${e2eTotal} e2e (${e2eBreakdown}).`
  const todo = `${REPO}/TODO.md`
  const dirty = replaceLineBetween(todo, 'TEST-COUNTS', summary)
  console.log(dirty ? `Updated test counts: ${total} total` : `Test counts up to date: ${total} total`)
}
main()
