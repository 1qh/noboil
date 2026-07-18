interface CreateSchemaUtilsOptions {
  baseTables?: (content: string) => SchemaTable[]
  schemaFactoryMap?: Record<string, string>
  wrapperFactories: string[]
}
interface FactoryCall {
  factory: string
  file: string
  options: string
  table: string
}
interface SchemaField {
  field: string
  type: string
}
interface SchemaTable {
  factory: string
  fields: SchemaField[]
  table: string
}
const childSchemaPat = /child\(\{[^}]*schema\s*:\s*object\(\{/gu
// eslint-disable-next-line sonarjs/super-linear-regex -- disjoint classes (\w vs \s/':'), no ambiguous backtracking
const childNamePat = /(?<cname>\w+)\s*:\s*child\(/u
const childValidPat = /child\(\{[^}]*foreignKey[^}]*parent[^}]*schema/u
// eslint-disable-next-line sonarjs/super-linear-regex -- disjoint classes (\w vs \s/':'), no ambiguous backtracking
const objPropPat = /(?<pname>\w+)\s*:\s*object\(\{/gu
// eslint-disable-next-line sonarjs/super-linear-regex, regexp/no-super-linear-backtracking -- disjoint classes (\w vs \s/':') and a single anchored `.+`, no ambiguous backtracking
const fieldLinePat = /^(?<fname>\w+)\s*:\s*(?<ftype>.+)$/u
const trailingCommaPat = /,$/u
// eslint-disable-next-line sonarjs/super-linear-regex -- bounded negated class, no ambiguous quantifier
const parenContentPat = /\([^)]*\)/gu
// eslint-disable-next-line sonarjs/super-linear-regex -- bounded negated class, no ambiguous quantifier
const braceContentPat = /\{[^}]*\}/gu
const schemaFactoryMapBase: Record<string, string> = {
  child: 'childCrud',
  makeBase: 'cacheCrud',
  makeOrgScoped: 'orgCrud',
  makeOwned: 'crud',
  makeSingleton: 'singletonCrud'
}
const CRUD_BASE = ['create', 'update', 'rm']
const CRUD_PUB = ['pub.list', 'pub.read']
const ORG_CRUD_BASE = ['list', 'read', 'create', 'update', 'rm']
const ORG_ACL = ['addEditor', 'removeEditor', 'setEditors', 'editors']
const CHILD_BASE = ['list', 'create', 'update', 'rm']
const CACHE_BASE = ['get', 'all', 'list', 'create', 'update', 'rm', 'invalidate', 'purge', 'load', 'refresh']
const SINGLETON_BASE = ['get', 'upsert']
const hasOption = (opts: string, key: string): boolean => opts.includes(key)
const findBlockEnd = (content: string, startPos: number): number => {
  let depth = 1
  let pos = startPos
  while (pos < content.length && depth > 0) {
    const c = content[pos]
    if (c === '(' || c === '{' || c === '[') depth += 1
    else if (c === ')' || c === '}' || c === ']') depth -= 1
    pos += 1
  }
  return pos
}
const findBraceBlockEnd = (content: string, startPos: number): number => {
  let depth = 1
  let pos = startPos
  while (pos < content.length && depth > 0) {
    if (content[pos] === '{') depth += 1
    else if (content[pos] === '}') depth -= 1
    pos += 1
  }
  return pos
}
const parseFieldLine = (trimmed: string): SchemaField | undefined => {
  if (trimmed.length === 0 || trimmed.startsWith('//')) return
  const m = fieldLinePat.exec(trimmed)
  if (!m?.groups) return
  const { fname: field, ftype: rawType } = m.groups
  if (!(field && rawType)) return
  const typeStr = rawType
    .replace(trailingCommaPat, '')
    .trim()
    .replace(parenContentPat, '()')
    .replace(braceContentPat, '{}')
  return { field, type: typeStr }
}
const parseObjectFields = (content: string, startPos: number): SchemaField[] => {
  const pos = findBlockEnd(content, startPos)
  const block = content.slice(startPos, pos - 1)
  const fields: SchemaField[] = []
  for (const line of block.split('\n')) {
    const parsed = parseFieldLine(line.trim())
    if (parsed) fields.push(parsed)
  }
  return fields
}
const pushChildTable = ({
  content,
  factory,
  fm,
  mergedFactoryMap,
  tables
}: {
  content: string
  factory: string
  fm: RegExpExecArray
  mergedFactoryMap: Record<string, string>
  tables: SchemaTable[]
}): void => {
  const startBlock = fm.index + fm[0].length
  if (!childValidPat.test(content.slice(fm.index))) return
  const lookback = Math.max(0, fm.index - 50)
  const tableLine = childNamePat.exec(content.slice(lookback, fm.index + 10))
  const tableName = tableLine?.groups?.cname ?? 'unknown'
  const fields = parseObjectFields(content, startBlock)
  tables.push({ factory: mergedFactoryMap[factory] ?? factory, fields, table: tableName })
}
const pushWrapperTables = ({
  content,
  factory,
  fm,
  mergedFactoryMap,
  tables
}: {
  content: string
  factory: string
  fm: RegExpExecArray
  mergedFactoryMap: Record<string, string>
  tables: SchemaTable[]
}): void => {
  const startBlock = fm.index + fm[0].length
  const end = findBraceBlockEnd(content, startBlock)
  const block = content.slice(startBlock, end - 1)
  const pp = new RegExp(objPropPat.source, 'gu')
  for (;;) {
    const pm = pp.exec(block)
    if (!pm) break
    const tableName = pm.groups?.pname ?? 'unknown'
    const objStart = block.indexOf('{', pm.index + pm[0].length - 1) + 1
    const fields = parseObjectFields(block, objStart)
    tables.push({ factory: mergedFactoryMap[factory] ?? factory, fields, table: tableName })
  }
}
/**
 * Build schema-introspection utilities (`extractSchemaFields`, `extractFactoryCalls`, ...)
 * bound to a backend's wrapper factories and base tables. Used by `noboil convex check`
 * and `noboil stdb check` to parse user schema files without executing them.
 */
const createSchemaUtils = ({ baseTables, schemaFactoryMap, wrapperFactories }: CreateSchemaUtilsOptions) => {
  const mergedFactoryMap = { ...schemaFactoryMapBase, ...schemaFactoryMap }
  const extractSchemaFields = (content: string): SchemaTable[] => {
    const tables = baseTables ? baseTables(content) : []
    for (const factory of [...wrapperFactories, 'child']) {
      const pat = factory === 'child' ? new RegExp(childSchemaPat.source, 'gu') : new RegExp(`${factory}\\(\\{`, 'gu')
      for (;;) {
        const fm = pat.exec(content)
        if (!fm) break
        if (factory === 'child') pushChildTable({ content, factory, fm, mergedFactoryMap, tables })
        else pushWrapperTables({ content, factory, fm, mergedFactoryMap, tables })
      }
    }
    return tables
  }
  const endpointsForFactory = (call: FactoryCall): string[] => {
    const { factory, options: opts } = call
    if (factory === 'singletonCrud') return [...SINGLETON_BASE]
    if (factory === 'cacheCrud') return [...CACHE_BASE]
    if (factory === 'childCrud') {
      const eps = [...CHILD_BASE]
      if (hasOption(opts, 'pub')) eps.push('pub.list', 'pub.get')
      return eps
    }
    if (factory === 'orgCrud') {
      const eps = [...ORG_CRUD_BASE]
      if (hasOption(opts, 'acl')) eps.push(...ORG_ACL)
      if (hasOption(opts, 'softDelete')) eps.push('restore')
      if (hasOption(opts, 'search')) eps.push('search')
      return eps
    }
    const eps = [...CRUD_BASE, ...CRUD_PUB]
    if (hasOption(opts, 'search')) eps.push('pub.search')
    if (hasOption(opts, 'softDelete')) eps.push('restore')
    return eps
  }
  return { endpointsForFactory, extractSchemaFields }
}
export type { CreateSchemaUtilsOptions, FactoryCall, SchemaField, SchemaTable }
export {
  CACHE_BASE,
  CHILD_BASE,
  createSchemaUtils,
  CRUD_BASE,
  CRUD_PUB,
  hasOption,
  ORG_ACL,
  ORG_CRUD_BASE,
  parseObjectFields,
  SINGLETON_BASE
}
