#!/usr/bin/env bun
/* eslint-disable no-console */
/* oxlint-disable unicorn/prefer-top-level-await */
import { $ } from 'bun'
import { resolve } from 'node:path'
import { replaceLineBetween } from './lib'
const REPO = resolve(import.meta.dir, '../..')
const PASS_RE = /(?<pass>\d+)\s+pass/u
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
const main = async () => {
  console.log('Counting tests (this takes ~30s)...')
  const [cvxPure, stdbPure, cvxFTest, libTotal] = await Promise.all([
    runCount(`${REPO}/lib/noboil`, 'src/convex/__tests__/pure.test.ts'),
    runCount(`${REPO}/lib/noboil`, 'src/spacetimedb/__tests__/pure.test.ts'),
    runCount(`${REPO}/backend/convex`, 'convex/f.test.ts'),
    runFullCount(`${REPO}/lib/noboil`)
  ])
  const total = libTotal + cvxFTest
  const summary = `${total} tests passing — ${libTotal} unit (incl. ${cvxPure} cvx pure + ${stdbPure} stdb pure) + ${cvxFTest} cvx integration. Run e2e per app via \`bun run test:e2e\` — counts vary as suites grow.`
  const todo = `${REPO}/TODO.md`
  const dirty = replaceLineBetween(todo, 'TEST-COUNTS', summary)
  console.log(dirty ? `Updated test counts: ${total} total` : `Test counts up to date: ${total} total`)
}
main()
