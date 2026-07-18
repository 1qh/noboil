#!/usr/bin/env bun
/* eslint-disable no-console */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DOCS_DIR, replaceBetween, REPO } from './lib'

const DEMOS = ['blog', 'chat', 'movie', 'org', 'poll']
const TEST_RE = /\b(?:test|it)\(\s*['"`]/gu
const walk = (dir: string, out: string[] = []): string[] => {
  // oxlint-disable-next-line node/no-sync
  if (!statSync(dir, { throwIfNoEntry: false })) return out
  // oxlint-disable-next-line node/no-sync
  for (const name of readdirSync(dir).toSorted((a, b) => (a < b ? -1 : Number(a > b))))
    if (!(name.startsWith('.') || name === 'node_modules' || name === '.next')) {
      const full = join(dir, name)
      // oxlint-disable-next-line node/no-sync
      if (statSync(full).isDirectory()) walk(full, out)
      else out.push(full)
    }
  return out
}
const collectRoutes = (root: string, base = ''): string[] => {
  // oxlint-disable-next-line node/no-sync
  if (!statSync(root, { throwIfNoEntry: false })) return []
  const out: string[] = []
  // oxlint-disable-next-line node/no-sync
  for (const name of readdirSync(root).toSorted((a, b) => (a < b ? -1 : Number(a > b))))
    if (!(name.startsWith('.') || name === 'node_modules' || name === 'api')) {
      const full = join(root, name)
      // oxlint-disable-next-line node/no-sync
      const s = statSync(full)
      if (s.isDirectory()) out.push(...collectRoutes(full, `${base}/${name}`))
      else if (name === 'page.tsx') out.push(base || '/')
    }
  return out.toSorted((a, b) => (a < b ? -1 : Number(a > b)))
}
const countTests = (dir: string): number => {
  let n = 0
  // oxlint-disable-next-line node/no-sync
  if (!statSync(dir, { throwIfNoEntry: false })) return 0
  // oxlint-disable-next-line node/no-sync
  for (const f of readdirSync(dir).toSorted((a, b) => (a < b ? -1 : Number(a > b))))
    if (f.endsWith('.test.ts')) {
      // oxlint-disable-next-line node/no-sync
      const src = readFileSync(`${dir}/${f}`, 'utf8')
      let m = TEST_RE.exec(src)
      while (m) {
        n += 1
        m = TEST_RE.exec(src)
      }
      TEST_RE.lastIndex = 0
    }
  return n
}
const countSrcLines = (root: string): number => {
  // oxlint-disable-next-line node/no-sync
  if (!statSync(root, { throwIfNoEntry: false })) return 0
  let total = 0
  for (const f of walk(root))
    if ((f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts'))
      // oxlint-disable-next-line node/no-sync
      total += readFileSync(f, 'utf8').split('\n').length
  return total
}
const KNOWN_BACKEND_ONLY = {
  cvx: new Set<string>(),
  stdb: new Set(['/dev'])
}
const SRC_LOC_EXEMPT: Record<string, string> = {
  movie:
    'stdb-movie does TMDB fetching client-side (no server-side action available); cvx delegates to action — architectural difference, see base.fetcher in option-parity above'
}
const buildDemoRow = (demo: string): { ok: boolean; row: string } => {
  const cvxRoot = `${REPO}/web/cvx/${demo}`
  const stdbRoot = `${REPO}/web/stdb/${demo}`
  const cvxRoutes = collectRoutes(`${cvxRoot}/src/app`)
  const stdbRoutes = collectRoutes(`${stdbRoot}/src/app`)
  const cvxOnly = cvxRoutes.filter(r => !(stdbRoutes.includes(r) || KNOWN_BACKEND_ONLY.cvx.has(r)))
  const stdbOnly = stdbRoutes.filter(r => !(cvxRoutes.includes(r) || KNOWN_BACKEND_ONLY.stdb.has(r)))
  const cvxTests = countTests(`${cvxRoot}/e2e`)
  const stdbTests = countTests(`${stdbRoot}/e2e`)
  const cvxSrc = countSrcLines(`${cvxRoot}/src`)
  const stdbSrc = countSrcLines(`${stdbRoot}/src`)
  const routesOk = cvxOnly.length === 0 && stdbOnly.length === 0
  const testsOk = cvxTests === stdbTests
  const srcDiffPct = Math.abs(cvxSrc - stdbSrc) / Math.max(cvxSrc, stdbSrc)
  const srcExempt = Boolean(SRC_LOC_EXEMPT[demo])
  const srcOk = srcDiffPct < 0.4 || srcExempt
  const allOk = routesOk && testsOk && srcOk
  const status = allOk ? '🟢' : '🟡'
  const routesCol = routesOk
    ? `${cvxRoutes.length}/${stdbRoutes.length} ✓`
    : `${cvxRoutes.length}/${stdbRoutes.length} (cvx-only: ${cvxOnly.join(', ') || '—'}, stdb-only: ${stdbOnly.join(', ') || '—'})`
  const row = `| \`${demo}\` | ${routesCol} | ${cvxTests} / ${stdbTests} ${testsOk ? '✓' : '⚠'} | ${cvxSrc} / ${stdbSrc} ${srcOk ? '✓' : '⚠'} | ${status} |`
  return { ok: allOk, row }
}
const main = () => {
  const rows: string[] = []
  let perfectCount = 0
  for (const demo of DEMOS) {
    const { ok, row } = buildDemoRow(demo)
    if (ok) perfectCount += 1
    rows.push(row)
  }
  const intentional: string[] = []
  for (const r of KNOWN_BACKEND_ONLY.stdb)
    intentional.push(`- **\`stdb${r}\`** — SpacetimeDB SchemaPlayground dev tool (cvx has no equivalent component)`)
  for (const [demo, reason] of Object.entries(SRC_LOC_EXEMPT))
    intentional.push(`- **\`${demo}\` src LOC asymmetry** — ${reason}`)
  const body = [
    'Per-demo parity audit. Each of the 5 demos compared across both backends: route count, e2e test count, source LOC.',
    '',
    `**${perfectCount}/${DEMOS.length} demos at full parity.** Backend-specific routes (intentional asymmetries) listed below.`,
    '',
    '| Demo | Routes (cvx/stdb) | E2E tests (cvx/stdb) | Source LOC (cvx/stdb) | Status |',
    '|---|---|---|---|--|',
    ...rows,
    '',
    intentional.length > 0 ? '### Backend-specific routes (intentional)\n' : '',
    ...intentional
  ]
    .filter(Boolean)
    .join('\n')
  const target = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(target, 'DEMO-PARITY', body)
  if (dirty) console.log(`Updated demo parity (${perfectCount}/${DEMOS.length} full)`)
}
main()
