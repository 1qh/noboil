#!/usr/bin/env bun
/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/* eslint-disable no-console, max-depth, complexity */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FactoryCall } from './check'
import { bold, dim, green, red, yellow } from '../ansi'
import { readJsonSafe } from '../shared/env-file'
import { listTypeScriptFiles } from '../shared/walk'
import {
  accessForFactory,
  checkIndexCoverage,
  checkSchemaConsistency,
  endpointsForFactory,
  extractSchemaFields,
  HEALTH_ERROR_PENALTY,
  HEALTH_MAX,
  HEALTH_WARN_PENALTY
} from './check'

interface CheckResult {
  details: string[]
  status: 'fail' | 'pass' | 'warn'
  title: string
}
const STATUS_ICON: Record<string, string> = { fail: red('✗'), pass: green('✓'), warn: yellow('!') }
const schemaMarkers = ['schema(', 'table(', 't.']
const reducerPat = /reducer\(\s*['"](?<table>\w+)\.(?<endpoint>[\w.]+)['"]/gu
const isSchemaFile = (content: string): boolean => {
  for (const marker of schemaMarkers) if (content.includes(marker)) return true
  return false
}
// eslint-disable-next-line sonarjs/cognitive-complexity -- directory-tree search across candidate module locations
const findModuleDir = (root: string): string | undefined => {
  const candidates = [
    root,
    join(root, 'module'),
    join(root, 'src', 'module'),
    join(root, 'src'),
    join(root, 'backend', 'spacetimedb', 'src')
  ]
  for (const candidate of candidates) {
    // oxlint-disable-next-line node/no-sync
    const exists = existsSync(candidate)
    if (exists) {
      const files = listTypeScriptFiles(candidate)
      for (const file of files) {
        // oxlint-disable-next-line node/no-sync
        const content = readFileSync(file, 'utf8')
        if (isSchemaFile(content)) return candidate
      }
    }
  }
  // oxlint-disable-next-line node/no-sync
  const rootExists = existsSync(root)
  if (!rootExists) return
  // oxlint-disable-next-line node/no-sync
  for (const sub of readdirSync(root, { withFileTypes: true }))
    if (sub.isDirectory()) {
      const nested = join(root, sub.name, 'module')
      // oxlint-disable-next-line node/no-sync
      if (existsSync(nested)) {
        const files = listTypeScriptFiles(nested)
        for (const file of files) {
          // oxlint-disable-next-line node/no-sync
          const content = readFileSync(file, 'utf8')
          if (isSchemaFile(content)) return nested
        }
      }
    }
}
const findSchemaFile = (moduleDir: string): undefined | { content: string; path: string } => {
  const files = listTypeScriptFiles(moduleDir)
  for (const full of files) {
    // oxlint-disable-next-line node/no-sync
    const content = readFileSync(full, 'utf8')
    if (isSchemaFile(content) && content.includes('schema(') && content.includes('table(')) return { content, path: full }
  }
}
const extractFactoryCalls = (moduleDir: string): FactoryCall[] => {
  const files = listTypeScriptFiles(moduleDir)
  const byTable = new Map<string, { endpoints: Set<string>; file: string }>()
  for (const full of files) {
    // oxlint-disable-next-line node/no-sync
    const content = readFileSync(full, 'utf8')
    const file = full.slice(moduleDir.length + 1)
    let m = reducerPat.exec(content)
    while (m) {
      const table = m.groups?.table ?? ''
      const endpoint = m.groups?.endpoint ?? ''
      if (table && endpoint) {
        const entry = byTable.get(table) ?? { endpoints: new Set<string>(), file }
        entry.endpoints.add(endpoint)
        byTable.set(table, entry)
      }
      m = reducerPat.exec(content)
    }
    reducerPat.lastIndex = 0
  }
  const calls: FactoryCall[] = []
  for (const [table, entry] of byTable)
    calls.push({ factory: 'reducer', file: entry.file, options: `endpoints=${[...entry.endpoints].join(',')}`, table })
  return calls
}
const checkSpacetimeCli = (): CheckResult => {
  // oxlint-disable-next-line node/no-sync -- CLI tool: synchronous spawn by design
  const result = spawnSync('spacetime', ['--version'], { encoding: 'utf8' }) // eslint-disable-line sonarjs/no-os-command-from-path -- dev tooling, trusted PATH
  if (result.status !== 0)
    return {
      details: ['spacetime CLI not found on PATH — install from https://spacetimedb.com/install'],
      status: 'fail',
      title: 'Spacetime CLI'
    }
  const version = (result.stdout || result.stderr || '').trim()
  return { details: [version || 'spacetime CLI available'], status: 'pass', title: 'Spacetime CLI' }
}
const checkDocker = (): CheckResult => {
  // oxlint-disable-next-line node/no-sync -- CLI tool: synchronous spawn by design
  const result = spawnSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' }) // eslint-disable-line sonarjs/no-os-command-from-path -- dev tooling, trusted PATH
  if (result.status !== 0)
    return { details: ['Docker not running or not installed'], status: 'warn', title: 'Docker Health' }
  const names = result.stdout.trim().split('\n').filter(Boolean)
  const spacetimeContainers: string[] = []
  for (const name of names) if (name.toLowerCase().includes('spacetime')) spacetimeContainers.push(name)
  if (spacetimeContainers.length === 0)
    return { details: ['No running containers matched "spacetime"'], status: 'warn', title: 'Docker Health' }
  return { details: [`Running: ${spacetimeContainers.join(', ')}`], status: 'pass', title: 'Docker Health' }
}
const checkEslintContent = (content?: string): CheckResult => {
  if (content === undefined)
    return { details: ['No lintmax.config.ts file found'], status: 'warn', title: 'ESLint Configuration' }
  if (content.includes('noboil/spacetimedb/eslint'))
    return {
      details: ['noboil/spacetimedb/eslint plugin configured'],
      status: 'pass',
      title: 'ESLint Configuration'
    }
  return {
    details: ['lintmax.config.ts found but noboil/spacetimedb/eslint not referenced'],
    status: 'warn',
    title: 'ESLint Configuration'
  }
}
const checkDeps = (pkg: null | Record<string, unknown>): CheckResult => {
  if (!pkg) return { details: ['No package.json found'], status: 'fail', title: 'Dependencies' }
  const deps = (pkg.dependencies ?? {}) as Record<string, string>
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>
  const all = { ...deps, ...devDeps }
  const details: string[] = []
  const required = ['noboil/spacetimedb', 'spacetimedb', 'zod']
  let missing = 0
  for (const name of required)
    if (all[name]) details.push(`${name}: ${all[name]}`)
    else {
      details.push(`${name}: not found`)
      missing += 1
    }
  return { details, status: missing ? 'fail' : 'pass', title: 'Dependencies' }
}
const calcHealthScore = (results: CheckResult[]): number => {
  let score = HEALTH_MAX
  for (const r of results)
    if (r.status === 'fail') score -= HEALTH_ERROR_PENALTY
    else if (r.status === 'warn') score -= HEALTH_WARN_PENALTY
  return Math.max(0, score)
}
/** Machine-readable doctor result. Emitted as JSON when `--json` flag is passed. */
interface DoctorReport {
  failed: number
  health: number
  passed: number
  results: CheckResult[]
  warned: number
}
const emitJson = (report: DoctorReport) => {
  process.stdout.write(`${JSON.stringify(report)}\n`)
}
// eslint-disable-next-line sonarjs/cognitive-complexity -- top-level diagnostics orchestration branching json vs human output per check
const doctor = (opts?: { json?: boolean }) => {
  const json = opts?.json ?? false
  const root = process.cwd()
  if (!json) console.log(bold('\nnoboil stdb doctor\n'))
  const moduleDir = findModuleDir(root)
  if (!moduleDir) {
    if (json)
      emitJson({
        failed: 1,
        health: 0,
        passed: 0,
        results: [{ details: ['SpacetimeDB schema directory not found'], status: 'fail', title: 'Schema Consistency' }],
        warned: 0
      })
    else {
      console.log(red('✗ Could not find SpacetimeDB schema directory (module/ or src/)'))
      console.log(dim('  Run from project root or a directory containing module/ or src/'))
    }
    process.exit(1)
  }
  const schemaFile = findSchemaFile(moduleDir)
  if (!schemaFile) {
    if (json)
      emitJson({
        failed: 1,
        health: 0,
        passed: 0,
        results: [
          { details: ['schema file with SpacetimeDB markers not found'], status: 'fail', title: 'Schema Consistency' }
        ],
        warned: 0
      })
    else {
      console.log(red('✗ Could not find schema file with SpacetimeDB markers'))
      console.log(dim('  Expected a .ts file using schema()/table().'))
    }
    process.exit(1)
  }
  const calls = extractFactoryCalls(moduleDir)
  const tables = extractSchemaFields(schemaFile.content)
  const results: CheckResult[] = []
  const schemaIssues = checkSchemaConsistency(moduleDir, schemaFile)
  const schemaErrors = schemaIssues.filter(i => i.level === 'error')
  const schemaWarns = schemaIssues.filter(i => i.level === 'warn')
  if (schemaErrors.length > 0)
    results.push({ details: schemaErrors.map(e => e.message), status: 'fail', title: 'Schema Consistency' })
  else if (schemaWarns.length > 0)
    results.push({
      details: [`${tables.length} tables, ${calls.length} reducer groups, ${schemaWarns.length} warning(s)`],
      status: 'warn',
      title: 'Schema Consistency'
    })
  else
    results.push({
      details: [`${tables.length} tables, ${calls.length} reducer groups, all matched`],
      status: 'pass',
      title: 'Schema Consistency'
    })
  let totalEps = 0
  for (const c of calls) totalEps += endpointsForFactory(c).length
  results.push({
    details: [`${totalEps} reducers from ${calls.length} table groups`],
    status: 'pass',
    title: 'Reducer Coverage'
  })
  const indexIssues = checkIndexCoverage(moduleDir, calls)
  if (indexIssues.length > 0)
    results.push({
      details: [`${indexIssues.length} unindexed where clause(s)`, ...indexIssues.map(i => i.message)],
      status: 'warn',
      title: 'Index Coverage'
    })
  else results.push({ details: ['All where clauses have matching indexes'], status: 'pass', title: 'Index Coverage' })
  const levels = new Set<string>()
  for (const c of calls) for (const e of accessForFactory(c)) levels.add(e.level)
  results.push(
    {
      details: [`Access levels: ${[...levels].join(', ') || 'none'}`],
      status: 'pass',
      title: 'Access Control'
    },
    checkSpacetimeCli(),
    checkDocker()
  )
  const lintmaxConfigPath = join(root, 'lintmax.config.ts')
  // oxlint-disable-next-line node/no-sync
  const eslintContent = existsSync(lintmaxConfigPath) ? readFileSync(lintmaxConfigPath, 'utf8') : undefined
  results.push(checkEslintContent(eslintContent))
  const pkgPath = join(root, 'package.json')
  const pkg = readJsonSafe(pkgPath) as null | Record<string, unknown>
  results.push(checkDeps(pkg))
  let passed = 0
  let warned = 0
  let failed = 0
  for (const r of results)
    if (r.status === 'pass') passed += 1
    else if (r.status === 'warn') warned += 1
    else failed += 1
  const score = calcHealthScore(results)
  if (json) {
    emitJson({ failed, health: score, passed, results, warned })
    return
  }
  for (const r of results) {
    const icon = STATUS_ICON[r.status] ?? '?'
    console.log(`[${icon}] ${r.title}`)
    for (const d of r.details) console.log(`    • ${d}`)
    console.log('')
  }
  let scoreColor = red
  if (score >= 90) scoreColor = green
  else if (score >= 70) scoreColor = yellow
  console.log(`Summary: ${passed} passed, ${warned} warning(s), ${failed} error(s)`)
  const scoreText = scoreColor(`${score}/${HEALTH_MAX}`)
  console.log(`Health Score: ${scoreText}\n`)
}
const run = (argv: readonly string[] = []) => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: noboil stdb doctor [--json]')
    console.log('  --json   Emit machine-readable report to stdout (one JSON object).')
    return
  }
  doctor({ json: argv.includes('--json') })
}
if (import.meta.main) run()
export { calcHealthScore, checkDeps, checkDocker, checkEslintContent, checkSpacetimeCli, doctor, run }
export type { CheckResult }
