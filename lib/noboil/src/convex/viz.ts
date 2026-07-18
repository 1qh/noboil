#!/usr/bin/env bun
/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ChildInfo, TableInfo } from '../shared/viz'
import { bold, dim, findBracketEnd, isSchemaFile, printSummary, red } from '../shared/viz'
import { wrapperFactories } from './schema-utils'

const schemaMarkers = ['makeOwned(', 'makeOrgScoped(', 'makeSingleton(', 'makeBase(', 'child(']
const TYPE_LABELS: Record<string, string> = {
  makeBase: 'cache',
  makeOrgScoped: 'org-scoped',
  makeOwned: 'owned',
  makeSingleton: 'singleton'
}
const ZID_PAT = /zid\(['"](?<zname>\w+)['"]\)/u
const FIELD_PAT = /^\s*(?<fname>\w+)\s*:/u
const FK_PAT = /foreignKey\s*:\s*['"](?<fk>\w+)['"]/u
const PARENT_PAT = /parent\s*:\s*['"](?<pn>\w+)['"]/u
const SCHEMA_OBJ_PAT = /schema\s*:\s*object\(\{/u
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
      if (isSchemaFile(content, schemaMarkers)) return { content, path: full }
    }
}
const extractFieldType = (raw: string): string => {
  const t = raw.trim()
  if (t.includes('file()')) return 'file'
  if (t.includes('files()')) return 'file[]'
  if (t.includes('zid(')) {
    const m = ZID_PAT.exec(t)
    return m ? `id<${m.groups?.zname ?? ''}>` : 'id'
  }
  if (t.includes('array(')) return 'array'
  if (t.includes('boolean()') || t.startsWith('boolean')) return 'boolean'
  if (t.includes('number()') || t.startsWith('number')) return 'number'
  if (t.includes('zenum(') || t.includes('enum(')) return 'enum'
  if (t.includes('union(')) return 'union'
  if (t.includes('object(')) return 'object'
  return 'string'
}
const extractFieldsFromBlock = (block: string): { name: string; type: string }[] => {
  const fields: { name: string; type: string }[] = []
  const lines = block.split('\n')
  for (const line of lines) {
    const m = FIELD_PAT.exec(line)
    if (m) {
      const rest = line.slice(line.indexOf(':') + 1)
      fields.push({ name: m.groups?.fname ?? '', type: extractFieldType(rest) })
    }
  }
  return fields
}
const extractWrapperTables = (content: string): TableInfo[] => {
  const tables: TableInfo[] = []
  const processFactory = (factory: string) => {
    const pat = new RegExp(`${factory}\\(\\{`, 'gu')
    let fm = pat.exec(content)
    while (fm !== null) {
      const endPos = findBracketEnd(content, fm.index + fm[0].length)
      const outerBlock = content.slice(fm.index + fm[0].length, endPos)
      // eslint-disable-next-line sonarjs/super-linear-regex -- linear: \w and \s match disjoint character classes, so adjacent quantifiers cannot overlap-backtrack
      const propPat = /(?<tname>\w+)\s*:\s*object\(\{/gu
      let pm = propPat.exec(outerBlock)
      while (pm !== null) {
        const start = pm.index + pm[0].length
        const fieldEnd = findBracketEnd(outerBlock, start)
        const fieldBlock = outerBlock.slice(start, fieldEnd)
        tables.push({
          fields: extractFieldsFromBlock(fieldBlock),
          name: pm.groups?.tname ?? '',
          tableType: TYPE_LABELS[factory] ?? factory
        })
        pm = propPat.exec(outerBlock)
      }
      fm = pat.exec(content)
    }
  }
  for (const factory of wrapperFactories) processFactory(factory)
  return tables
}
const extractChildFields = (block: string): { name: string; type: string }[] => {
  const schemaMatch = SCHEMA_OBJ_PAT.exec(block)
  if (!schemaMatch) return []
  const sStart = block.indexOf('{', schemaMatch.index + schemaMatch[0].length - 1) + 1
  return extractFieldsFromBlock(block.slice(sStart, findBracketEnd(block, sStart)))
}
const extractChildren = (content: string): ChildInfo[] => {
  const children: ChildInfo[] = []
  // eslint-disable-next-line sonarjs/super-linear-regex -- linear: \w and \s match disjoint character classes, so adjacent quantifiers cannot overlap-backtrack
  const pat = /(?<cname>\w+)\s*:\s*child\(\{/gu
  let m = pat.exec(content)
  while (m) {
    const start = m.index + m[0].length
    const block = content.slice(start, findBracketEnd(content, start))
    children.push({
      fields: extractChildFields(block),
      foreignKey: FK_PAT.exec(block)?.groups?.fk ?? '',
      name: m.groups?.cname ?? '',
      parent: PARENT_PAT.exec(block)?.groups?.pn ?? '',
      tableType: 'child'
    })
    m = pat.exec(content)
  }
  return children
}
const escapeField = (name: string) => name.replaceAll('_', '_')
const entityBlock = (name: string, fields: { name: string; type: string }[]): string[] => {
  const lines = [`    ${name} {`]
  for (const f of fields) lines.push(`        ${f.type} ${escapeField(f.name)}`)
  lines.push('    }')
  return lines
}
const foreignKeyEdges = (tables: TableInfo[], children: ChildInfo[]): string[] => {
  const lines: string[] = []
  const allNames = new Set([...tables.map(x => x.name), ...children.map(x => x.name)])
  for (const t of tables)
    for (const f of t.fields)
      if (f.type.startsWith('id<') && f.type !== 'id<_storage>') {
        const target = f.type.slice(3, -1)
        if (allNames.has(target)) lines.push(`    ${target} ||--o{ ${t.name} : "${f.name}"`)
      }
  return lines
}
const generateMermaid = (tables: TableInfo[], children: ChildInfo[]): string => {
  const lines: string[] = ['erDiagram']
  for (const t of tables) lines.push(...entityBlock(t.name, t.fields))
  for (const c of children) {
    lines.push(...entityBlock(c.name, c.fields))
    if (c.parent) lines.push(`    ${c.parent} ||--o{ ${c.name} : "${c.foreignKey}"`)
  }
  lines.push(...foreignKeyEdges(tables, children))
  return lines.join('\n')
}
const run = (argv: string[] = process.argv.slice(2)) => {
  const root = process.cwd()
  const flags = new Set(argv)
  console.log(bold('\nnoboil/convex viz\n'))
  const convexDir = findConvexDir(root)
  if (!convexDir) {
    console.log(red('\u2717 Could not find convex/ directory with _generated/'))
    process.exit(1)
  }
  const schemaFile = findSchemaFile(convexDir)
  if (!schemaFile) {
    console.log(red('\u2717 Could not find schema file with noboil/convex markers'))
    process.exit(1)
  }
  console.log(`${dim('schema:')} ${schemaFile.path}\n`)
  const tables = extractWrapperTables(schemaFile.content)
  const children = extractChildren(schemaFile.content)
  if (tables.length === 0 && children.length === 0) {
    console.log(red('\u2717 No tables found in schema'))
    process.exit(1)
  }
  if (flags.has('--mermaid')) {
    console.log(generateMermaid(tables, children))
    return
  }
  printSummary(tables, children)
  console.log(dim('Run with --mermaid for ER diagram output\n'))
}
if (import.meta.main) run()
export { extractChildren, extractFieldsFromBlock, extractFieldType, extractWrapperTables, generateMermaid, run }
