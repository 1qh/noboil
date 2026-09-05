/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
import type {
  ArgSpecs,
  IntrospectedValidator,
  ManifestArg,
  ManifestCommand,
  ManifestNode,
  ProviderMeta,
  RegistryEntry,
  SchemaNode,
  ValidatorJson
} from './types'
import { introspect } from './types'

interface Meta {
  enum?: readonly string[]
  max?: number
  min?: number
  type: string
}
type Providers = Record<string, ProviderMeta>
type Registry = Record<string, RegistryEntry>
const KEBAB = (s: string): string => s.replaceAll('_', '-')
const PRIMITIVE_KINDS: Record<string, Meta> = {
  array: { type: 'array' },
  boolean: { type: 'boolean' },
  float64: { type: 'number' },
  id: { type: 'string' },
  int64: { type: 'number' },
  number: { type: 'number' },
  object: { type: 'object' },
  string: { type: 'string' }
}
const unionMeta = (val: IntrospectedValidator): Meta => {
  const lits: string[] = []
  for (const m of val.members ?? []) if (m.kind === 'literal' && typeof m.value === 'string') lits.push(m.value)
  return lits.length > 0 ? { enum: lits, type: 'enum' } : { type: 'union' }
}
const validatorMeta = (val: IntrospectedValidator): Meta => {
  const primitive = PRIMITIVE_KINDS[val.kind]
  if (primitive) return primitive
  if (val.kind === 'union') return unionMeta(val)
  if (val.kind === 'literal') return { enum: typeof val.value === 'string' ? [val.value] : [], type: 'enum' }
  if (val.kind === 'optional' && val.value && typeof val.value === 'object' && 'kind' in val.value)
    return validatorMeta(val.value as IntrospectedValidator)
  return { type: 'unknown' }
}
type ArgSpec = ArgSpecs[string]
const buildArgEntry = (name: string, spec: ArgSpec): ManifestArg => {
  const { type, enum: en } = validatorMeta(introspect(spec.v))
  const entry: ManifestArg = {
    description: spec.description,
    name: `--${KEBAB(name)}`,
    required: spec.required !== false,
    type
  }
  if (en) entry.enum = en
  if (spec.aliases && spec.aliases.length > 0) entry.aliases = spec.aliases.map(a => `--${KEBAB(a)}`)
  if (spec.pattern !== undefined) entry.pattern = spec.pattern
  if (spec.min !== undefined) entry.min = spec.min
  if (spec.max !== undefined) entry.max = spec.max
  if (spec.minLength !== undefined) entry.minLength = spec.minLength
  if (spec.maxLength !== undefined) entry.maxLength = spec.maxLength
  if (spec.integer !== undefined) entry.integer = spec.integer
  return entry
}
const buildArgs = (specs: ArgSpecs): ManifestArg[] =>
  Object.entries(specs).map(([name, spec]) => buildArgEntry(name, spec))
const exampleFromFixture = (path: readonly string[], fixture: Record<string, unknown>): string => {
  const [provider, ...rest] = path.map(KEBAB)
  const parts: string[] = [provider ?? '', ...rest]
  for (const [k, val] of Object.entries(fixture)) {
    parts.push(`--${KEBAB(k)}`)
    if (typeof val === 'string') parts.push(val.includes(' ') || val.length === 0 ? `"${val}"` : val)
    else parts.push(String(val))
  }
  return parts.join(' ')
}
const schemaToJson = (s: SchemaNode): ValidatorJson => {
  if (s.kind === 'string') return { type: 'string' }
  if (s.kind === 'number') return { type: 'number' }
  if (s.kind === 'boolean') return { type: 'boolean' }
  if (s.kind === 'null') return { type: 'unknown' }
  if (s.kind === 'enum') return { enum: s.values, type: 'enum' }
  if (s.kind === 'array') return { element: schemaToJson(s.element), type: 'array' }
  if (s.kind === 'object') {
    const shape: Record<string, ValidatorJson> = {}
    for (const [k, v] of Object.entries(s.shape)) shape[k] = schemaToJson(v.schema)
    return { shape, type: 'object' }
  }
  if (s.kind === 'union') {
    const nonNull = s.members.filter(m => m.kind !== 'null')
    const [first] = nonNull
    if (nonNull.length === 1 && first) return schemaToJson(first)
    const obj = nonNull.find(m => m.kind === 'object')
    if (obj) return schemaToJson(obj)
    return { type: 'unknown' }
  }
  return { type: 'unknown' }
}
const buildCommand = (entry: RegistryEntry): ManifestCommand => ({
  args: buildArgs(entry.argSpecs),
  cost: entry.meta.cost,
  deprecated: entry.meta.deprecated ?? null,
  description: entry.meta.description === '' ? (entry.inferredDescription ?? '') : entry.meta.description,
  deterministic: entry.meta.deterministic,
  errorCodes: entry.meta.errorCodes,
  examples: entry.meta.examples.length > 0 ? entry.meta.examples : [exampleFromFixture(entry.path, entry.meta.selfTest)],
  exclusive: entry.meta.exclusive,
  output: entry.inferredSchema ? schemaToJson(entry.inferredSchema) : { type: 'unknown' },
  version: entry.meta.version
})
const ensureChildren = (node: ManifestNode): Record<string, ManifestNode> => {
  node.children ??= {}
  return node.children
}
const insertCommand = (opts: { entry: RegistryEntry; providers: Providers; root: Record<string, ManifestNode> }): void => {
  const { entry, providers, root } = opts
  const [provider, ...rest] = entry.path
  if (!provider || rest.length === 0) return
  const last = rest.at(-1)
  if (!last) return
  const providerMeta = providers[provider]
  root[provider] ??= { children: {}, description: providerMeta?.description, kind: 'provider' }
  let node = root[provider]
  for (let i = 0; i < rest.length - 1; i += 1) {
    const seg = rest[i]
    if (!seg) return
    const kebab = KEBAB(seg)
    const children = ensureChildren(node)
    children[kebab] ??= { children: {}, kind: 'group' }
    node = children[kebab]
  }
  ensureChildren(node)[KEBAB(last)] = { command: buildCommand(entry), kind: 'command' }
}
const pathsEqual = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((p, i) => p === b[i])
const matchPrefix = (entry: readonly string[], snake: readonly string[]): number => {
  let match = 0
  const upper = Math.min(entry.length, snake.length)
  while (match < upper && entry[match] === snake[match]) match += 1
  return match
}
/** Build the manifest tree from a filtered registry. Visibility (tier / enabled) is the caller's concern. */
const buildTree = (opts: { providers: Providers; registry: Registry }): Record<string, ManifestNode> => {
  const root: Record<string, ManifestNode> = {}
  for (const entry of Object.values(opts.registry)) insertCommand({ entry, providers: opts.providers, root })
  return root
}
const findCommand = (registry: Registry, path: readonly string[]): null | RegistryEntry =>
  Object.values(registry).find(entry => pathsEqual(entry.path, path)) ?? null
const findValidPath = (
  registry: Registry,
  path: readonly string[]
): { validChildren: string[]; validPath: readonly string[] } => {
  let bestMatch = 0
  for (const entry of Object.values(registry)) {
    const m = matchPrefix(entry.path, path)
    if (m > bestMatch) bestMatch = m
  }
  const validPath = path.slice(0, bestMatch)
  const childSet = new Set<string>()
  for (const entry of Object.values(registry)) {
    const isMatchAtPrefix = matchPrefix(entry.path, path) >= bestMatch && entry.path.length > bestMatch
    const seg = isMatchAtPrefix ? entry.path[bestMatch] : null
    if (seg) childSet.add(seg)
  }
  return { validChildren: [...childSet].toSorted((a, b) => a.localeCompare(b)), validPath }
}
export { buildArgs, buildTree, findCommand, findValidPath }
