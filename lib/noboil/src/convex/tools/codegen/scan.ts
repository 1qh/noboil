/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/* oxlint-disable unicorn/prefer-spread */
import { Glob } from 'bun'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const TIER_ADMIN_PREFIX = '_admin'
const SKIP_DIRS = new Set(['_app', '_lib', 'generated'])
const CAMEL_RE = /[A-Z]/gu
const TS_EXT_RE = /\.ts$/u
const LEADING_UNDERSCORE_RE = /^_/u
const camelToKebab = (s: string): string => s.replace(CAMEL_RE, m => `-${m.toLowerCase()}`)
interface ToolFile {
  absPath: string
  cliPath: string[]
  exportName: ToolKind
  fnAccessor: string
  importPath: string
  importVar: string
  kind: ToolKind
  modulePath: string[]
  registryKey: string
  tier: 'admin' | 'user'
}
type ToolKind = 'action' | 'mutation' | 'query'
const KIND_RE = /(?:export )?const (?<exp>action|query|mutation) = define(?<def>Tool|Query|Mutation)\(/u
const detectKind = async (abs: string): Promise<null | { exportName: ToolKind; kind: ToolKind }> => {
  const text = await readFile(abs, 'utf8')
  const m = KIND_RE.exec(text)
  const exp = m?.groups?.exp
  const def = m?.groups?.def
  if (!(exp && def)) return null
  const kindMap = { Mutation: 'mutation', Query: 'query', Tool: 'action' } as const
  return { exportName: exp as ToolKind, kind: kindMap[def as 'Mutation' | 'Query' | 'Tool'] }
}
const buildToolFile = async ({
  filename,
  provider,
  rel,
  segments,
  toolsRoot
}: {
  filename: string
  provider: string
  rel: string
  segments: string[]
  toolsRoot: string
}): Promise<null | ToolFile> => {
  const baseName = filename.replace(TS_EXT_RE, '')
  const moduleSegs = segments.slice(0, -1).concat(baseName)
  const cliSegs = moduleSegs.map((s, i) =>
    i === 0 ? camelToKebab(s.replace(LEADING_UNDERSCORE_RE, '')) : camelToKebab(s)
  )
  const tier = provider.startsWith(TIER_ADMIN_PREFIX) ? 'admin' : 'user'
  const importPath = `../${moduleSegs.join('/')}`
  const importVar = `${moduleSegs.map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1))).join('')}_mod`
  const absPath = resolve(toolsRoot, rel)
  const detected = await detectKind(absPath)
  if (!detected) return null
  const fnAccessor = `internal.tools.${moduleSegs.join('.')}.${detected.exportName}`
  return {
    absPath,
    cliPath: cliSegs,
    exportName: detected.exportName,
    fnAccessor,
    importPath,
    importVar,
    kind: detected.kind,
    modulePath: moduleSegs,
    registryKey: cliSegs.join('.'),
    tier
  }
}
const collect = async (toolsRoot: string): Promise<{ providers: string[]; tools: ToolFile[] }> => {
  const tools: ToolFile[] = []
  const providers = new Set<string>()
  const glob = new Glob('*/**/*.ts')
  for await (const rel of glob.scan({ cwd: toolsRoot })) {
    const segments = rel.split('/')
    const [provider] = segments
    const filename = segments.at(-1)
    if (
      provider &&
      filename &&
      segments.length >= 2 &&
      !SKIP_DIRS.has(provider) &&
      !segments.slice(1).some(s => s.startsWith('_'))
    ) {
      providers.add(provider)
      const tool = await buildToolFile({ filename, provider, rel, segments, toolsRoot })
      if (tool) tools.push(tool)
    }
  }
  return {
    providers: [...providers].toSorted((a, b) => a.localeCompare(b)),
    tools: tools.toSorted((a, b) => a.registryKey.localeCompare(b.registryKey))
  }
}
export { camelToKebab, collect }
export type { ToolFile, ToolKind }
