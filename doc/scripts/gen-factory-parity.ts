#!/usr/bin/env bun
/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FACTORY_META } from '../../lib/noboil/src/shared/factory-meta'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween, REPO } from './lib'

interface FactorySpec {
  brand: string
  cvxFactoryFn: string
  cvxSourceFile: string
  slot: string
  stdbFactoryFn: string
  stdbSourceFile: string
}
const SPECS: FactorySpec[] = [
  {
    brand: 'base',
    cvxFactoryFn: 'cacheCrud',
    cvxSourceFile: 'cache-crud.ts',
    slot: 'base',
    stdbFactoryFn: 'makeCacheCrud',
    stdbSourceFile: 'cache-crud.ts'
  },
  {
    brand: 'child',
    cvxFactoryFn: 'childCrud',
    cvxSourceFile: 'child.ts',
    slot: 'children',
    stdbFactoryFn: 'makeChildCrud',
    stdbSourceFile: 'child.ts'
  },
  {
    brand: 'kv',
    cvxFactoryFn: 'kv',
    cvxSourceFile: 'kv.ts',
    slot: 'kv',
    stdbFactoryFn: 'makeKv',
    stdbSourceFile: 'kv.ts'
  },
  {
    brand: 'log',
    cvxFactoryFn: 'log',
    cvxSourceFile: 'log.ts',
    slot: 'log',
    stdbFactoryFn: 'makeLog',
    stdbSourceFile: 'log.ts'
  },
  {
    brand: 'orgDef',
    cvxFactoryFn: 'orgSchema',
    cvxSourceFile: 'org-crud.ts',
    slot: 'org',
    stdbFactoryFn: 'orgSchema',
    stdbSourceFile: 'org-crud.ts'
  },
  {
    brand: 'org',
    cvxFactoryFn: 'orgCrud',
    cvxSourceFile: 'org-crud.ts',
    slot: 'orgScoped',
    stdbFactoryFn: 'makeOrgCrud',
    stdbSourceFile: 'org-crud.ts'
  },
  {
    brand: 'owned',
    cvxFactoryFn: 'crud',
    cvxSourceFile: 'crud.ts',
    slot: 'owned',
    stdbFactoryFn: 'makeCrud',
    stdbSourceFile: 'crud.ts'
  },
  {
    brand: 'quota',
    cvxFactoryFn: 'quota',
    cvxSourceFile: 'quota.ts',
    slot: 'quota',
    stdbFactoryFn: 'makeQuota',
    stdbSourceFile: 'quota.ts'
  },
  {
    brand: 'singleton',
    cvxFactoryFn: 'singletonCrud',
    cvxSourceFile: 'singleton.ts',
    slot: 'singleton',
    stdbFactoryFn: 'makeSingleton',
    stdbSourceFile: 'singleton.ts'
  }
]
const findTablesInSlot = (src: string, slot: string): string[] => {
  const re = new RegExp(`\\n\\s{2}${slot}:\\s*\\{`, 'u')
  const m = re.exec(src)
  if (!m) return []
  const start = m.index + m[0].length
  let depth = 1
  let i = start
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') depth -= 1
    i += 1
  }
  const body = src.slice(start, i - 1)
  const out: string[] = []
  const tableRe = /\n\s{4}(?<name>\w+):/gu
  let tm = tableRe.exec(body)
  while (tm) {
    if (tm.groups?.name) out.push(tm.groups.name)
    tm = tableRe.exec(body)
  }
  return out
}
const tableUsedInLazy = (lazy: string, schemaTable: string): boolean =>
  new RegExp(`\\bs\\.${schemaTable}\\b`, 'u').test(lazy)
const tableUsedInBackend = (backendDir: string, schemaTable: string): boolean => {
  // oxlint-disable-next-line node/no-sync
  if (!statSync(backendDir, { throwIfNoEntry: false })) return false
  const re = new RegExp(`\\bs\\.${schemaTable}\\b`, 'u')
  // oxlint-disable-next-line node/no-sync
  for (const f of readdirSync(backendDir).toSorted((a, b) => (a < b ? -1 : Number(a > b))))
    if (f.endsWith('.ts')) {
      // oxlint-disable-next-line node/no-sync
      const content = readFileSync(`${backendDir}/${f}`, 'utf8')
      if (re.test(content)) return true
    }
  return false
}
const lazyNameForSchema = (lazy: string, schemaTable: string): string | undefined => {
  const m = new RegExp(`(?<name>\\w+):\\s*table\\(s\\.${schemaTable}\\b`, 'u').exec(lazy)
  return m?.groups?.name
}
const scanEntry = ({ dir, name, re, stack }: { dir: string; name: string; re: RegExp; stack: string[] }): boolean => {
  if (name.startsWith('.') || name === 'node_modules' || name === '.next' || name === 'module_bindings') return false
  const full = join(dir, name)
  // oxlint-disable-next-line node/no-sync
  if (statSync(full).isDirectory()) {
    stack.push(full)
    return false
  }
  // oxlint-disable-next-line node/no-sync
  const content = readFileSync(full, 'utf8')
  return (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.test.ts') && re.test(content)
}
const rootMatches = (root: string, re: RegExp): boolean => {
  // oxlint-disable-next-line node/no-sync
  if (!statSync(root, { throwIfNoEntry: false })) return false
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (dir)
      // oxlint-disable-next-line node/no-sync
      for (const name of readdirSync(dir).toSorted((a, b) => (a < b ? -1 : Number(a > b))))
        if (scanEntry({ dir, name, re, stack })) return true
  }
  return false
}
const tableUsedInDemos = (demoRoots: string[], names: string[]): boolean => {
  if (names.length === 0) return false
  const reBody = names.map(n => `\\b${n}\\w*\\b`).join('|')
  const re = new RegExp(reBody, 'u')
  for (const root of demoRoots) if (rootMatches(root, re)) return true
  return false
}
const walkTests = (dir: string, out: string[] = []): string[] => {
  // oxlint-disable-next-line node/no-sync
  if (!statSync(dir, { throwIfNoEntry: false })) return out
  // oxlint-disable-next-line node/no-sync
  for (const name of readdirSync(dir).toSorted((a, b) => (a < b ? -1 : Number(a > b))))
    if (!(name.startsWith('.') || name === 'node_modules')) {
      const full = join(dir, name)
      // oxlint-disable-next-line node/no-sync
      if (statSync(full).isDirectory()) walkTests(full, out)
      else if (name.endsWith('.test.ts')) out.push(full)
    }
  return out
}
const factoryAppearsInTests = (testRoot: string, fn: string): boolean => {
  const re = new RegExp(`\\b${fn}\\b`, 'u')
  // oxlint-disable-next-line node/no-sync
  for (const f of walkTests(testRoot)) if (re.test(readFileSync(f, 'utf8'))) return true
  return false
}
const isStr = (n: string | undefined): n is string => typeof n === 'string'
const DEMOS = ['blog', 'chat', 'movie', 'org', 'poll']
interface ParityCtx {
  cvxDemoRoots: string[]
  cvxLazy: string
  cvxTestRoot: string
  docsDir: string
  sSrc: string
  stdbDemoRoots: string[]
  stdbLazy: string
  stdbSSrc: string
  stdbTestRoot: string
}
const buildParityRow = (spec: FactorySpec, ctx: ParityCtx): { ok: boolean; row: string } => {
  const cvxTables = findTablesInSlot(ctx.sSrc, spec.slot)
  const stdbTables = findTablesInSlot(ctx.stdbSSrc, spec.slot)
  const cvxRegistered = cvxTables.filter(
    t => tableUsedInLazy(ctx.cvxLazy, t) || tableUsedInBackend(`${REPO}/backend/convex/convex`, t)
  )
  const stdbRegistered = stdbTables.filter(t => tableUsedInLazy(ctx.stdbLazy, t))
  const cvxDemoUsed = cvxTables.filter(t => {
    const lazyName = lazyNameForSchema(ctx.cvxLazy, t)
    return tableUsedInDemos(ctx.cvxDemoRoots, [t, lazyName].filter(isStr))
  })
  const stdbDemoUsed = stdbTables.filter(t => {
    const lazyName = lazyNameForSchema(ctx.stdbLazy, t)
    return tableUsedInDemos(ctx.stdbDemoRoots, [t, lazyName].filter(isStr))
  })
  // oxlint-disable-next-line node/no-sync
  const cvxSrc = existsSync(`${LIB_NOBOIL}/src/convex/server/${spec.cvxSourceFile}`)
  // oxlint-disable-next-line node/no-sync
  const stdbSrc = existsSync(`${LIB_NOBOIL}/src/spacetimedb/server/${spec.stdbSourceFile}`)
  const cvxTests = factoryAppearsInTests(ctx.cvxTestRoot, spec.cvxFactoryFn)
  const stdbTests = factoryAppearsInTests(ctx.stdbTestRoot, spec.stdbFactoryFn)
  // oxlint-disable-next-line node/no-sync
  const allDocs = readdirSync(ctx.docsDir)
    .toSorted((a, b) => (a < b ? -1 : Number(a > b)))
    .filter(f => f.endsWith('.mdx'))
    // oxlint-disable-next-line node/no-sync
    .map(f => readFileSync(`${ctx.docsDir}/${f}`, 'utf8'))
    .join('\n')
  const docOk =
    new RegExp(`\\b${spec.cvxFactoryFn}\\b`, 'u').test(allDocs) ||
    new RegExp(`\\b${spec.stdbFactoryFn}\\b`, 'u').test(allDocs)
  const cvxOk = cvxSrc && cvxRegistered.length > 0 && cvxDemoUsed.length > 0 && cvxTests
  const stdbOk = stdbSrc && stdbRegistered.length > 0 && stdbDemoUsed.length > 0 && stdbTests
  const allOk = cvxOk && stdbOk && docOk
  const cvxCell = `${cvxSrc ? '✓' : '✗'} src · ${cvxRegistered.length}/${cvxTables.length} reg · ${cvxDemoUsed.length} demos · ${cvxTests ? '✓' : '✗'} tests`
  const stdbCell = `${stdbSrc ? '✓' : '✗'} src · ${stdbRegistered.length}/${stdbTables.length} reg · ${stdbDemoUsed.length} demos · ${stdbTests ? '✓' : '✗'} tests`
  const tableCount = Math.max(cvxTables.length, stdbTables.length)
  const row = `| \`${spec.slot}\` (\`${spec.brand}\`) | ${tableCount} | ${cvxCell} | ${stdbCell} | ${docOk ? '✓' : '✗'} | ${allOk ? '🟢' : '🟡'} |`
  return { ok: allOk, row }
}
const main = () => {
  // oxlint-disable-next-line node/no-sync
  const sSrc = readFileSync(`${REPO}/backend/convex/s.ts`, 'utf8')
  // oxlint-disable-next-line node/no-sync
  const stdbSSrc = readFileSync(`${REPO}/backend/spacetimedb/s.ts`, 'utf8')
  // oxlint-disable-next-line node/no-sync
  const cvxLazy = readFileSync(`${REPO}/backend/convex/lazy.ts`, 'utf8')
  // oxlint-disable-next-line node/no-sync
  const stdbLazy = readFileSync(`${REPO}/backend/spacetimedb/src/index.ts`, 'utf8')
  const ctx: ParityCtx = {
    cvxDemoRoots: DEMOS.map(d => `${REPO}/web/cvx/${d}`),
    cvxLazy,
    cvxTestRoot: `${LIB_NOBOIL}/src/convex`,
    docsDir: DOCS_DIR,
    sSrc,
    stdbDemoRoots: DEMOS.map(d => `${REPO}/web/stdb/${d}`),
    stdbLazy,
    stdbSSrc,
    stdbTestRoot: `${LIB_NOBOIL}/src/spacetimedb`
  }
  const rows: string[] = []
  let perfect = 0
  for (const spec of SPECS)
    if (FACTORY_META[spec.brand]) {
      const { ok, row } = buildParityRow(spec, ctx)
      if (ok) perfect += 1
      rows.push(row)
    }
  const body = [
    'Per-factory parity. Each factory checked: source file present, at least one demo table registered in the entry point, table referenced by ≥1 demo app, factory name referenced in tests, and dedicated doc page.',
    '',
    `**${perfect}/${SPECS.length} factories at full parity.**`,
    '',
    '| Slot (Brand) | Tables | Convex (src · reg · demos · tests) | SpacetimeDB (src · reg · demos · tests) | Docs | Status |',
    '|---|--:|---|---|--|--|',
    ...rows
  ].join('\n')
  const target = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(target, 'FACTORY-PARITY', body)
  console.log(
    dirty
      ? `Updated factory parity (${perfect}/${SPECS.length} full)`
      : `Factory parity up to date (${perfect}/${SPECS.length})`
  )
}
main()
