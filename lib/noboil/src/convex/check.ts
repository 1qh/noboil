#!/usr/bin/env bun
/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { Issue } from '../shared/schema-types'
import type { FactoryCall, SchemaField, SchemaTable } from './schema-utils'
import { bold, dim, green, red, yellow } from '../ansi'
import { FACTORY_INVOKE_NAMES, SCHEMA_MARKERS } from '../shared/factory-meta'
import {
  CACHE_BASE,
  CHILD_BASE,
  CRUD_PUB,
  endpointsForFactory,
  extractSchemaFields,
  hasOption,
  ORG_ACL,
  parseObjectFields,
  SINGLETON_BASE,
  wrapperFactories
} from './schema-utils'

interface AccessEntry {
  endpoints: string[]
  level: string
}
interface TableIndex {
  fields: string[]
  name: string
  type: 'custom' | 'default' | 'search'
}
interface WhereField {
  field: string
  source: string
  table: string
}
const schemaMarkers = SCHEMA_MARKERS
const factoryPat = new RegExp(`(?<factory>${FACTORY_INVOKE_NAMES.join('|')})\\(\\s*['"](?<table>\\w+)['"]`, 'gu')
const filePrefix = (file?: string): string => (file ? `${dim(file)} ` : '')
const tableHeader = (call: FactoryCall): string => {
  const factoryTag = dim(`(${call.factory})`)
  const fileTag = dim(`— ${call.file}`)
  return `  ${bold(call.table)} ${factoryTag} ${fileTag}`
}
const isSchemaFile = (content: string): boolean => {
  for (const marker of schemaMarkers) if (content.includes(marker)) return true
  return false
}
// oxlint-disable-next-line node/no-sync
const hasGenerated = (dir: string): boolean => existsSync(join(dir, '_generated'))
const findConvexDir = (root: string): string | undefined => {
  const direct = join(root, 'convex')
  if (hasGenerated(direct)) return direct
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(root)) return
  // oxlint-disable-next-line node/no-sync
  for (const sub of readdirSync(root, { withFileTypes: true }))
    if (sub.isDirectory()) {
      const nested = join(root, sub.name, 'convex')
      if (hasGenerated(nested)) return nested
    }
}
const findSchemaFile = (convexDir: string): undefined | { content: string; path: string } => {
  const searchDir = dirname(convexDir)
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(searchDir)) return
  // oxlint-disable-next-line node/no-sync
  for (const entry of readdirSync(searchDir))
    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.config.ts')) {
      const full = join(searchDir, entry)
      // oxlint-disable-next-line node/no-sync
      const content = readFileSync(full, 'utf8')
      if (isSchemaFile(content)) return { content, path: full }
    }
}
const readBalancedBraceBlock = (content: string, startPos: number): string => {
  let depth = 1
  let pos = startPos
  while (pos < content.length && depth > 0) {
    if (content[pos] === '{') depth += 1
    else if (content[pos] === '}') depth -= 1
    pos += 1
  }
  return content.slice(startPos, pos - 1)
}
const collectObjectTables = (block: string, tables: Set<string>): void => {
  // eslint-disable-next-line sonarjs/super-linear-regex -- linear: \w and \s match disjoint character classes, so adjacent quantifiers cannot overlap-backtrack
  const propPat = /(?<pname>\w+)\s*:\s*object\(/gu
  let pm = propPat.exec(block)
  while (pm) {
    if (pm.groups?.pname) tables.add(pm.groups.pname)
    pm = propPat.exec(block)
  }
}
const collectChildTables = (content: string, tables: Set<string>): void => {
  // eslint-disable-next-line sonarjs/super-linear-regex -- linear: \w and \s match disjoint character classes, so adjacent quantifiers cannot overlap-backtrack
  const childPat = /(?<cname>\w+)\s*:\s*child\(/gu
  let cm = childPat.exec(content)
  while (cm) {
    if (cm.groups?.cname) tables.add(cm.groups.cname)
    cm = childPat.exec(content)
  }
}
const extractSchemaTableNames = (content: string): Set<string> => {
  const tables = new Set<string>()
  for (const factory of wrapperFactories) {
    const pat = new RegExp(`${factory}\\(\\{`, 'gu')
    let fm: null | RegExpExecArray = pat.exec(content)
    while (fm !== null) {
      const block = readBalancedBraceBlock(content, fm.index + fm[0].length)
      collectObjectTables(block, tables)
      fm = pat.exec(content)
    }
  }
  collectChildTables(content, tables)
  return tables
}
const extractRemainingOptions = (content: string, startPos: number): string => {
  let depth = 1
  let pos = startPos
  while (pos < content.length && depth > 0) {
    if (content[pos] === '(') depth += 1
    else if (content[pos] === ')') depth -= 1
    pos += 1
  }
  return content.slice(startPos, pos - 1)
}
const extractFactoryCalls = (convexDir: string): { calls: FactoryCall[]; files: string[] } => {
  const calls: FactoryCall[] = []
  const files: string[] = []
  // oxlint-disable-next-line node/no-sync
  for (const entry of readdirSync(convexDir))
    if (entry.endsWith('.ts') && !entry.startsWith('_') && !entry.includes('.test.') && !entry.includes('.config.')) {
      const full = join(convexDir, entry)
      // oxlint-disable-next-line node/no-sync
      const content = readFileSync(full, 'utf8')
      files.push(entry)
      let m = factoryPat.exec(content)
      while (m) {
        if (m.groups?.factory && m.groups.table) {
          const afterTable = content.indexOf(m.groups.table, m.index) + m.groups.table.length
          const rest = extractRemainingOptions(content, afterTable)
          calls.push({ factory: m.groups.factory, file: entry, options: rest, table: m.groups.table })
        }
        m = factoryPat.exec(content)
      }
      factoryPat.lastIndex = 0
    }
  return { calls, files }
}
const PREVIEW_OPTION_NAMES = ['search', 'softDelete', 'acl', 'rateLimit', 'pub']
const collectTableOptions = (call?: FactoryCall): string[] => {
  if (!call) return []
  return PREVIEW_OPTION_NAMES.filter(opt => hasOption(call.options, opt))
}
const printSchemaPreview = (content: string, calls: FactoryCall[]) => {
  const tables = extractSchemaFields(content)
  console.log(bold('Schema Preview\n'))
  if (tables.length === 0) {
    console.log(dim('  No tables found in schema file.\n'))
    return
  }
  for (const t of tables) {
    const options = collectTableOptions(calls.find(c => c.table === t.table))
    const optTag = dim(`[${options.join(', ')}]`)
    const optStr = options.length > 0 ? ` ${optTag}` : ''
    const factoryTag = dim(`(${t.factory})`)
    console.log(`  ${bold(t.table)} ${factoryTag}${optStr}`)
    for (const f of t.fields) console.log(`    ${f.field.padEnd(20)} ${dim(f.type)}`)
    console.log('')
  }
  let totalFields = 0
  for (const t of tables) totalFields += t.fields.length
  console.log(`${bold(String(tables.length))} tables with ${bold(String(totalFields))} fields\n`)
}
const printEndpoints = (calls: FactoryCall[]) => {
  let total = 0
  console.log(bold('Generated Endpoints\n'))
  for (const call of calls) {
    const eps = endpointsForFactory(call)
    total += eps.length
    console.log(tableHeader(call))
    const groups: Record<string, string[]> = {}
    for (const ep of eps) {
      const dot = ep.indexOf('.')
      if (dot > 0) {
        const prefix = ep.slice(0, dot)
        const name = ep.slice(dot + 1)
        groups[prefix] ??= []
        groups[prefix].push(name)
      } else {
        groups[''] ??= []
        groups[''].push(ep)
      }
    }
    if (groups['']) console.log(`    ${groups[''].join(', ')}`)
    for (const [prefix, names] of Object.entries(groups))
      if (prefix) {
        const prefixTag = dim(`${prefix}.`)
        const sep = `, ${prefixTag}`
        console.log(`    ${prefixTag}${names.join(sep)}`)
      }
    console.log('')
  }
  console.log(`${bold(String(total))} endpoints from ${bold(String(calls.length))} factory calls\n`)
}
const checkSchemaConsistency = (convexDir: string, schemaFile: { content: string; path: string }): Issue[] => {
  const issues: Issue[] = []
  const schemaTables = extractSchemaTableNames(schemaFile.content)
  const { calls, files } = extractFactoryCalls(convexDir)
  const seen = new Map<string, string>()
  for (const call of calls) {
    if (seen.has(call.table))
      issues.push({
        file: call.file,
        level: 'error',
        message: `Duplicate factory for table "${call.table}" (also in ${seen.get(call.table)})`
      })
    else seen.set(call.table, call.file)
    if (!schemaTables.has(call.table))
      issues.push({
        file: call.file,
        level: 'error',
        message: `${call.factory}('${call.table}') but no "${call.table}" table found in schema`
      })
  }
  const factoryTables = new Set(calls.map(c => c.table))
  for (const table of schemaTables)
    if (!factoryTables.has(table))
      issues.push({
        file: basename(schemaFile.path),
        level: 'warn',
        message: `Table "${table}" defined in schema but no factory call found`
      })
  const convexFiles = new Set(files.map(f => f.replace('.ts', '')))
  for (const call of calls)
    if (call.table !== basename(call.file, '.ts') && !convexFiles.has(call.table))
      issues.push({
        file: call.file,
        level: 'warn',
        message: `${call.factory}('${call.table}') in ${call.file} — table name doesn't match filename`
      })
  return issues
}
const runCheck = (convexDir: string, schemaFile: { content: string; path: string }) => {
  const schemaTables = extractSchemaTableNames(schemaFile.content)
  const { calls } = extractFactoryCalls(convexDir)
  console.log(`${dim('tables in schema:')} ${[...schemaTables].join(', ') || 'none'}`)
  console.log(`${dim('factory calls:')}    ${calls.length}\n`)
  const issues = checkSchemaConsistency(convexDir, schemaFile)
  if (issues.length === 0) {
    console.log(green('\u2713 All checks passed\n'))
    return
  }
  const errors = issues.filter(i => i.level === 'error')
  const warnings = issues.filter(i => i.level === 'warn')
  for (const issue of errors) console.log(`${red('\u2717')} ${filePrefix(issue.file)}${issue.message}`)
  for (const issue of warnings) console.log(`${yellow('\u26A0')} ${filePrefix(issue.file)}${issue.message}`)
  const errStr = errors.length > 0 ? red(`${errors.length} error(s)`) : ''
  const warnStr = warnings.length > 0 ? yellow(`${warnings.length} warning(s)`) : ''
  const errWarnSep = errors.length > 0 && warnings.length > 0 ? ', ' : ''
  console.log(`\n${errStr}${errWarnSep}${warnStr}\n`)
  if (errors.length > 0) process.exit(1)
}
const FACTORY_DEFAULT_INDEXES: Record<string, TableIndex[]> = {
  cacheCrud: [],
  childCrud: [],
  crud: [{ fields: ['userId'], name: 'by_user', type: 'default' }],
  orgCrud: [
    { fields: ['orgId'], name: 'by_org', type: 'default' },
    { fields: ['orgId', 'userId'], name: 'by_org_user', type: 'default' }
  ],
  singletonCrud: [{ fields: ['userId'], name: 'by_user', type: 'default' }]
}
const RESERVED_WHERE_KEYS = new Set(['$between', '$gt', '$gte', '$lt', '$lte', 'or', 'own'])
const TABLE_HELPER_SRC = [
  'ownedTable',
  'orgTable',
  'orgChildTable',
  'childTable',
  'baseTable',
  'singletonTable',
  'defineTable'
].join('|')
const findSchemaDefFile = (convexDir: string): undefined | { content: string; path: string } => {
  // oxlint-disable-next-line node/no-sync
  for (const name of readdirSync(convexDir))
    if (name.endsWith('.ts') && !name.includes('.test.') && !name.startsWith('_')) {
      const full = join(convexDir, name)
      // oxlint-disable-next-line node/no-sync
      const content = readFileSync(full, 'utf8')
      if (content.includes('defineSchema(')) return { content, path: full }
    }
}
const extractCustomIndexes = (schemaContent: string): Map<string, TableIndex[]> => {
  const result = new Map<string, TableIndex[]>()
  const helperPat = new RegExp(`(\\w+)\\s*:\\s*(?:${TABLE_HELPER_SRC})\\s*\\(`, 'gu')
  const tables: { name: string; pos: number }[] = []
  let tm: null | RegExpExecArray = helperPat.exec(schemaContent)
  while (tm !== null) {
    const tName = tm[1] ?? ''
    tables.push({ name: tName, pos: tm.index })
    result.set(tName, [])
    tm = helperPat.exec(schemaContent)
  }
  for (let ti = 0; ti < tables.length; ti += 1) {
    const tEntry = tables[ti]
    if (!tEntry) break
    const nextEntry = tables[ti + 1]
    const start = tEntry.pos
    const end = nextEntry ? nextEntry.pos : schemaContent.length
    const segment = schemaContent.slice(start, end)
    const tableName = tEntry.name
    const indexes = result.get(tableName) ?? []
    const idxPat = /\.index\(\s*['"](?<iname>[^'"]+)['"]\s*,\s*\[(?<ifields>[^\]]*)\]\s*\)/gu
    let im = idxPat.exec(segment)
    while (im) {
      const idxName = im.groups?.iname ?? ''
      const idxFieldsRaw = im.groups?.ifields ?? ''
      const fields: string[] = []
      const fieldPat = /['"](?<fname>[^'"]+)['"]/gu
      let fm = fieldPat.exec(idxFieldsRaw)
      while (fm) {
        const fName = fm.groups?.fname ?? ''
        fields.push(fName)
        fm = fieldPat.exec(idxFieldsRaw)
      }
      indexes.push({ fields, name: idxName, type: 'custom' })
      im = idxPat.exec(segment)
    }
    const searchPat = /\.searchIndex\(\s*['"](?<sname>[^'"]+)['"]\s*,\s*\{[^}]*searchField:\s*['"](?<sfield>[^'"]+)['"]/gu
    let sm = searchPat.exec(segment)
    while (sm) {
      const sName = sm.groups?.sname ?? ''
      const sField = sm.groups?.sfield ?? ''
      indexes.push({ fields: [sField], name: sName, type: 'search' })
      sm = searchPat.exec(segment)
    }
    result.set(tableName, indexes)
  }
  return result
}
const extractWhereFromOptions = (opts: string): string[] => {
  const fields = new Set<string>()
  const whereIdx = opts.indexOf('where:')
  if (whereIdx === -1) return []
  const braceStart = opts.indexOf('{', whereIdx + 6)
  if (braceStart === -1) return []
  let depth = 1
  let pos = braceStart + 1
  while (pos < opts.length && depth > 0) {
    if (opts[pos] === '{') depth += 1
    else if (opts[pos] === '}') depth -= 1
    pos += 1
  }
  const block = opts.slice(braceStart + 1, pos - 1)
  // eslint-disable-next-line sonarjs/super-linear-regex -- linear: \w and \s match disjoint character classes, so adjacent quantifiers cannot overlap-backtrack
  const fieldPat = /(?<wkey>\$?\w+)\s*:/gu
  let fm = fieldPat.exec(block)
  while (fm) {
    const fKey = fm.groups?.wkey ?? ''
    if (!RESERVED_WHERE_KEYS.has(fKey)) fields.add(fKey)
    fm = fieldPat.exec(block)
  }
  return [...fields]
}
const scanWhereUsage = (root: string, cvxDir: string): WhereField[] => {
  const results: WhereField[] = []
  const schemaPath = join(cvxDir, 'schema.ts')
  const skip = new Set(['.cache', '.git', '.next', '.turbo', '_generated', 'build', 'dist', 'node_modules'])
  const processFile = (filePath: string, fileName: string) => {
    // oxlint-disable-next-line node/no-sync
    const fileContent = readFileSync(filePath, 'utf8')
    const apiPat = /api\.(?<tbl>\w+)\.(?:list|search)\b/gu
    let am = apiPat.exec(fileContent)
    while (am) {
      const table = am.groups?.tbl ?? ''
      const after = fileContent.slice(am.index, Math.min(am.index + 500, fileContent.length))
      const wIdx = after.indexOf('where:')
      if (wIdx !== -1 && wIdx < 200) {
        const wFields = extractWhereFromOptions(after.slice(Math.max(0, wIdx - 10)))
        for (const f of wFields) results.push({ field: f, source: fileName, table })
      }
      am = apiPat.exec(fileContent)
    }
  }
  const scan = (dir: string) => {
    // oxlint-disable-next-line node/no-sync
    if (!existsSync(dir)) return
    // oxlint-disable-next-line node/no-sync
    for (const entry of readdirSync(dir, { withFileTypes: true }))
      if (entry.isDirectory()) {
        if (!(skip.has(entry.name) || entry.name.startsWith('.'))) scan(join(dir, entry.name))
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.config.') &&
        join(dir, entry.name) !== schemaPath
      )
        processFile(join(dir, entry.name), entry.name)
  }
  scan(root)
  return results
}
const buildWhereByTable = (calls: FactoryCall[], projectWhere: WhereField[]): Map<string, Set<string>> => {
  const whereByTable = new Map<string, Set<string>>()
  const add = (table: string, field: string): void => {
    const set = whereByTable.get(table) ?? new Set<string>()
    set.add(field)
    whereByTable.set(table, set)
  }
  for (const w of projectWhere) add(w.table, w.field)
  for (const call of calls) for (const f of extractWhereFromOptions(call.options)) add(call.table, f)
  return whereByTable
}
const indexesFor = (
  call: FactoryCall,
  customIndexes: Map<string, TableIndex[]>
): { allFields: Set<string>; allIndexes: TableIndex[] } => {
  const defaults = FACTORY_DEFAULT_INDEXES[call.factory] ?? []
  const custom = customIndexes.get(call.table) ?? []
  const allIndexes = [...defaults, ...custom]
  const allFields = new Set<string>()
  for (const idx of allIndexes) for (const f of idx.fields) allFields.add(f)
  return { allFields, allIndexes }
}
const printCallIndexes = (opts: {
  call: FactoryCall
  customIndexes: Map<string, TableIndex[]>
  issues: Issue[]
  whereByTable: Map<string, Set<string>>
}): number => {
  const { call, customIndexes, whereByTable, issues } = opts
  const { allFields, allIndexes } = indexesFor(call, customIndexes)
  console.log(tableHeader(call))
  for (const idx of allIndexes) {
    const symbol = idx.type === 'search' ? dim('\uD83D\uDD0D') : green('\u2713')
    const fieldsTag = dim(`[${idx.fields.join(', ')}]`)
    const typeTag = dim(`(${idx.type})`)
    console.log(`    ${symbol} ${idx.name} ${fieldsTag} ${typeTag}`)
  }
  if (allIndexes.length === 0) console.log(`    ${dim('(no indexes)')}`)
  const tableWhereFields = whereByTable.get(call.table)
  if (tableWhereFields)
    for (const field of tableWhereFields)
      if (!allFields.has(field)) {
        console.log(`    ${yellow('\u26A0')} where filter on '${field}' \u2014 no matching index`)
        issues.push({
          file: call.file,
          level: 'warn',
          message: `"${call.table}": where on '${field}' is runtime-filtered. Add .index('by_${field}', ['${field}']) for better performance`
        })
      }
  console.log('')
  return allIndexes.length
}
const printIndexReport = (convexDir: string, calls: FactoryCall[]) => {
  const schemaDef = findSchemaDefFile(convexDir)
  const customIndexes = schemaDef ? extractCustomIndexes(schemaDef.content) : new Map<string, TableIndex[]>()
  const projectWhere = scanWhereUsage(dirname(convexDir), convexDir)
  const whereByTable = buildWhereByTable(calls, projectWhere)
  const issues: Issue[] = []
  console.log(bold('Index Analysis\n'))
  if (schemaDef) console.log(`${dim('schema def:')} ${schemaDef.path}\n`)
  let totalIndexes = 0
  for (const call of calls) totalIndexes += printCallIndexes({ call, customIndexes, issues, whereByTable })
  console.log(`${bold(String(totalIndexes))} indexes across ${bold(String(calls.length))} tables\n`)
  if (issues.length > 0) {
    console.log(bold('Performance Suggestions\n'))
    for (const issue of issues) console.log(`  ${yellow('\u26A0')} ${filePrefix(issue.file)}${issue.message}`)
    const unindexedSummary = yellow(`${issues.length} unindexed where clause(s)`)
    console.log(`\n${unindexedSummary}\n`)
  } else console.log(green('\u2713 All detected where clauses have matching indexes\n'))
}
const accessForFactory = (call: FactoryCall): AccessEntry[] => {
  const { factory, options: opts } = call
  const result: AccessEntry[] = []
  if (factory === 'cacheCrud') {
    result.push({ endpoints: [...CACHE_BASE], level: 'No Auth' })
    return result
  }
  if (factory === 'singletonCrud') {
    result.push({ endpoints: [...SINGLETON_BASE], level: 'Owner' })
    return result
  }
  if (factory === 'childCrud') {
    const ownerEps = [...CHILD_BASE]
    result.push({ endpoints: ownerEps, level: 'Parent Owner' })
    if (hasOption(opts, 'pub')) result.push({ endpoints: ['pub.list', 'pub.get'], level: 'Public' })
    return result
  }
  if (factory === 'orgCrud') {
    const memberEps = ['list', 'read']
    if (hasOption(opts, 'search')) memberEps.push('search')
    result.push({ endpoints: memberEps, level: 'Org Member' }, { endpoints: ['create', 'update'], level: 'Org Member' })
    const adminEps = ['rm']
    if (hasOption(opts, 'softDelete')) adminEps.push('restore')
    result.push({ endpoints: adminEps, level: 'Org Admin' })
    if (hasOption(opts, 'acl')) result.push({ endpoints: [...ORG_ACL], level: 'Org Admin' })
    return result
  }
  const pubEps = [...CRUD_PUB]
  if (hasOption(opts, 'search')) pubEps.push('pub.search')
  result.push({ endpoints: pubEps, level: 'Public' }, { endpoints: ['create'], level: 'Authenticated' })
  const ownerEps = ['update', 'rm']
  if (hasOption(opts, 'softDelete')) ownerEps.push('restore')
  result.push({ endpoints: ownerEps, level: 'Owner' })
  return result
}
const ACCESS_ICONS: Record<string, string> = {
  Authenticated: '\u{1F511}',
  'No Auth': '\u{1F310}',
  'Org Admin': '\u{1F6E1}\uFE0F',
  'Org Member': '\u{1F465}',
  Owner: '\u{1F464}',
  'Parent Owner': '\u{1F517}',
  Public: '\u{1F310}'
}
const printAccessReport = (calls: FactoryCall[]) => {
  console.log(bold('Access Control Matrix\n'))
  let totalEndpoints = 0
  for (const call of calls) {
    const entries = accessForFactory(call)
    console.log(tableHeader(call))
    for (const entry of entries) {
      const icon = ACCESS_ICONS[entry.level] ?? '\u2022'
      console.log(`    ${icon} ${yellow(entry.level)}: ${entry.endpoints.join(', ')}`)
      totalEndpoints += entry.endpoints.length
    }
    console.log('')
  }
  console.log(`${bold(String(totalEndpoints))} endpoints across ${bold(String(calls.length))} tables\n`)
}
const checkIndexCoverage = (convexDir: string, calls: FactoryCall[]): Issue[] => {
  const schemaDef = findSchemaDefFile(convexDir)
  const customIndexes = schemaDef ? extractCustomIndexes(schemaDef.content) : new Map<string, TableIndex[]>()
  const projectWhere = scanWhereUsage(dirname(convexDir), convexDir)
  const whereByTable = buildWhereByTable(calls, projectWhere)
  const issues: Issue[] = []
  for (const call of calls) {
    const { allFields } = indexesFor(call, customIndexes)
    const tableWhereFields = whereByTable.get(call.table)
    if (tableWhereFields)
      for (const field of tableWhereFields)
        if (!allFields.has(field))
          issues.push({
            file: call.file,
            level: 'warn',
            message: `"${call.table}": where on '${field}' — no matching index`
          })
  }
  return issues
}
const HEALTH_MAX = 100
const HEALTH_ERROR_PENALTY = 15
const HEALTH_WARN_PENALTY = 5
const pickScoreColor = (s: number): ((v: string) => string) => {
  if (s >= 90) return green
  if (s >= 70) return yellow
  return red
}
const countTotalEndpoints = (calls: FactoryCall[]): number => {
  let total = 0
  for (const call of calls) total += endpointsForFactory(call).length
  return total
}
const countTotalIndexes = (calls: FactoryCall[], customIndexes: Map<string, TableIndex[]>): number => {
  let total = 0
  for (const call of calls) {
    const defaults = FACTORY_DEFAULT_INDEXES[call.factory] ?? []
    total += defaults.length + (customIndexes.get(call.table) ?? []).length
  }
  return total
}
const collectAccessLevels = (calls: FactoryCall[]): Set<string> => {
  const levels = new Set<string>()
  for (const call of calls) for (const entry of accessForFactory(call)) levels.add(entry.level)
  return levels
}
const printHealthIssueGroup = (opts: { heading: string; issues: Issue[]; penalty: number; symbol: string }): void => {
  const { heading, penalty, symbol, issues } = opts
  if (issues.length === 0) return
  const penaltyTag = dim(`(-${penalty} pts each)`)
  console.log(`  ${heading} ${penaltyTag}\n`)
  for (const issue of issues) console.log(`    ${symbol} ${filePrefix(issue.file)}${issue.message}`)
  console.log('')
}
const printHealthReport = (convexDir: string, schemaFile: { content: string; path: string }) => {
  const { calls } = extractFactoryCalls(convexDir)
  const schemaDef = findSchemaDefFile(convexDir)
  const customIndexes = schemaDef ? extractCustomIndexes(schemaDef.content) : new Map<string, TableIndex[]>()
  const allIssues = [...checkSchemaConsistency(convexDir, schemaFile), ...checkIndexCoverage(convexDir, calls)]
  const errors = allIssues.filter(i => i.level === 'error')
  const warnings = allIssues.filter(i => i.level === 'warn')
  const rawScore = HEALTH_MAX - errors.length * HEALTH_ERROR_PENALTY - warnings.length * HEALTH_WARN_PENALTY
  const score = Math.max(0, Math.min(HEALTH_MAX, rawScore))
  const scoreColor = pickScoreColor(score)
  console.log(bold('Project Health Report\n'))
  const scoreStr = scoreColor(`${score}/100`)
  console.log(`  ${bold('Score:')} ${scoreStr}\n`)
  console.log(`  ${dim('Tables:')}      ${calls.length}`)
  console.log(`  ${dim('Endpoints:')}   ${countTotalEndpoints(calls)}`)
  console.log(`  ${dim('Indexes:')}     ${countTotalIndexes(calls, customIndexes)}`)
  console.log(`  ${dim('Access:')}      ${[...collectAccessLevels(calls)].join(', ')}\n`)
  printHealthIssueGroup({ heading: red('Errors'), issues: errors, penalty: HEALTH_ERROR_PENALTY, symbol: red('\u2717') })
  printHealthIssueGroup({
    heading: yellow('Warnings'),
    issues: warnings,
    penalty: HEALTH_WARN_PENALTY,
    symbol: yellow('\u26A0')
  })
  if (allIssues.length === 0) console.log(`  ${green('\u2713 No issues found')}\n`)
  console.log(
    `  ${dim('Run')} noboil convex check --schema ${dim('for schema preview')}\n` +
      `  ${dim('Run')} noboil convex check --endpoints ${dim('for endpoint list')}\n` +
      `  ${dim('Run')} noboil convex check --indexes ${dim('for index analysis')}\n` +
      `  ${dim('Run')} noboil convex check --access ${dim('for access matrix')}\n`
  )
}
const run = (argv: string[] = process.argv.slice(2)) => {
  const root = process.cwd()
  const flags = new Set(argv)
  console.log(bold('\nnoboil/convex check\n'))
  const convexDir = findConvexDir(root)
  if (!convexDir) {
    console.log(red('\u2717 Could not find convex/ directory with _generated/'))
    console.log(dim('  Run from project root or a directory containing convex/'))
    process.exit(1)
  }
  console.log(`${dim('convex dir:')} ${convexDir}`)
  const schemaFile = findSchemaFile(convexDir)
  if (!schemaFile) {
    console.log(red('\u2717 Could not find schema file with noboil/convex markers'))
    console.log(dim('  Expected a .ts file importing makeOwned/makeOrgScoped/etc.'))
    process.exit(1)
  }
  console.log(`${dim('schema:')}    ${schemaFile.path}\n`)
  if (flags.has('--endpoints')) {
    const { calls } = extractFactoryCalls(convexDir)
    printEndpoints(calls)
    return
  }
  if (flags.has('--schema')) {
    const { calls } = extractFactoryCalls(convexDir)
    printSchemaPreview(schemaFile.content, calls)
    return
  }
  if (flags.has('--health')) {
    printHealthReport(convexDir, schemaFile)
    return
  }
  if (flags.has('--access')) {
    const { calls } = extractFactoryCalls(convexDir)
    printAccessReport(calls)
    return
  }
  if (flags.has('--indexes')) {
    const { calls } = extractFactoryCalls(convexDir)
    printIndexReport(convexDir, calls)
    return
  }
  runCheck(convexDir, schemaFile)
}
if (import.meta.main) run()
export {
  accessForFactory,
  checkIndexCoverage,
  checkSchemaConsistency,
  endpointsForFactory,
  extractCustomIndexes,
  extractSchemaFields,
  extractWhereFromOptions,
  FACTORY_DEFAULT_INDEXES,
  HEALTH_ERROR_PENALTY,
  HEALTH_MAX,
  HEALTH_WARN_PENALTY,
  parseObjectFields,
  printAccessReport,
  printHealthReport,
  printIndexReport,
  printSchemaPreview,
  run,
  scanWhereUsage
}
export type { AccessEntry, FactoryCall, SchemaField, SchemaTable, TableIndex, WhereField }
