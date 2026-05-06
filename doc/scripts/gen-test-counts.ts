#!/usr/bin/env bun
/* eslint-disable no-console */
/* oxlint-disable unicorn/prefer-top-level-await */
import { $ } from 'bun'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { replaceLineBetween } from './lib'
const REPO = resolve(import.meta.dir, '../..')
const PASS_RE = /(?<pass>\d+)\s+pass/u
const TEST_CALL_RE = /(?:^|[\s;,([])(?:test|it)(?:\.skip|\.only|\.each\(.+?\))?\s*\(/gu
const runCount = async (cwd: string, file: string): Promise<number> => {
  const proc = await $`bun test ${file}`.cwd(cwd).quiet().nothrow()
  const out = (proc.stdout.toString() + proc.stderr.toString()).split('\n')
  for (const line of out) {
    const m = PASS_RE.exec(line)
    if (m?.groups?.pass) return Number(m.groups.pass)
  }
  return 0
}
const runFullCount = async (cwd: string): Promise<number> => {
  const proc = await $`bun test`.cwd(cwd).quiet().nothrow()
  const out = (proc.stdout.toString() + proc.stderr.toString()).split('\n')
  for (const line of out) {
    const m = PASS_RE.exec(line)
    if (m?.groups?.pass) return Number(m.groups.pass)
  }
  return 0
}
const walkE2E = (root: string): string[] => {
  const out: string[] = []
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) return out
  for (const name of readdirSync(root).toSorted()) {
    const p = join(root, name)
    if (statSync(p).isDirectory()) out.push(...walkE2E(p))
    else if (name.endsWith('.test.ts')) out.push(p)
  }
  return out
}
const countE2EFile = (path: string): number => {
  const src = readFileSync(path, 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/\/\/[^\n]*/gu, '')
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
  const [cvxPure, stdbPure, cvxFTest, libTotal] = await Promise.all([
    runCount(`${REPO}/lib/noboil`, 'src/convex/__tests__/pure.test.ts'),
    runCount(`${REPO}/lib/noboil`, 'src/spacetimedb/__tests__/pure.test.ts'),
    runCount(`${REPO}/backend/convex`, 'convex/f.test.ts'),
    runFullCount(`${REPO}/lib/noboil`)
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
  const total = libTotal + cvxFTest + e2eTotal
  const summary = `${total} tests — ${libTotal} unit (incl. ${cvxPure} cvx pure + ${stdbPure} stdb pure) + ${cvxFTest} cvx integration + ${e2eTotal} e2e (${e2eBreakdown}).`
  const todo = `${REPO}/TODO.md`
  const dirty = replaceLineBetween(todo, 'TEST-COUNTS', summary)
  console.log(dirty ? `Updated test counts: ${total} total` : `Test counts up to date: ${total} total`)
}
main()
