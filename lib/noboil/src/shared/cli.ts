/* eslint-disable no-console */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dim, green, yellow } from '../ansi'

interface ParseEnumFieldResult<T extends string> {
  name: string
  optional: boolean
  type: T | { enum: string[] }
}
const CAMEL_PAT = /(?<upper>[A-Z])/gu
const FIRST_CHAR_PAT = /^./u
/** `camelCase` → `Title Case`. Used in scaffold templates for default labels. */
const camelToTitle = (s: string) => s.replace(CAMEL_PAT, ' $1').replace(FIRST_CHAR_PAT, c => c.toUpperCase())
const ENUM_PAT = /^enum\((?<values>[^)]+)\)$/u
/** Parse a `name:type` or `name:enum(a,b)` field spec from the CLI's `--fields=` flag, with optional `?` suffix. */
const parseEnumFieldDef = <T extends string>(raw: string, validTypes: Set<T>): null | ParseEnumFieldResult<T> => {
  const parts = raw.split(':')
  if (parts.length !== 2) return null
  const name = (parts[0] ?? '').trim()
  let typePart = (parts[1] ?? '').trim()
  let optional = false
  if (typePart.endsWith('?')) {
    optional = true
    typePart = typePart.slice(0, -1)
  }
  const enumMatch = ENUM_PAT.exec(typePart)
  if (enumMatch?.groups?.values) {
    const values = enumMatch.groups.values.split(',').map(v => v.trim())
    return { name, optional, type: { enum: values } }
  }
  if (!validTypes.has(typePart as T)) return null
  return { name, optional, type: typePart as T }
}
/** True if any of `flags` (e.g. `'--help', '-h'`) appears in `args`. */
const hasFlag = (args: string[], ...flags: string[]) => {
  for (const arg of args) if (flags.includes(arg)) return true
  return false
}
/** Read `--name=value` style flag from argv, falling back to `fallback` if absent. */
const readEqFlag = (args: string[], name: string, fallback: string): string => {
  const prefix = `--${name}=`
  for (const arg of args) if (arg.startsWith(prefix)) return arg.slice(prefix.length)
  return fallback
}
/** Read either `--name=value` or `--name value` form, falling back to `fallback`. */
const readArgOrEqFlag = (args: string[], name: string, fallback: string): string => {
  const eq = readEqFlag(args, name, fallback)
  if (eq !== fallback) return eq
  const full = `--${name}`
  for (let i = 0; i < args.length; i += 1)
    if (args[i] === full) {
      const nextArg = args[i + 1]
      if (nextArg) return nextArg
    }
  return fallback
}
/** Write `content` to `path` only if absent (skip-and-log otherwise). Auto-creates parent dirs. Returns true on write. */
const writeIfNotExists = ({ content, label, path }: { content: string; label: string; path: string }): boolean => {
  // oxlint-disable-next-line node/no-sync
  if (existsSync(path)) {
    console.log(`  ${yellow('skip')} ${label} ${dim('(exists)')}`)
    return false
  }
  const dir = path.slice(0, path.lastIndexOf('/'))
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  // oxlint-disable-next-line node/no-sync
  writeFileSync(path, content)
  console.log(`  ${green('✓')} ${label}`)
  return true
}
/** Write a `[name, content]` list under `baseDir` via `writeIfNotExists`; returns `{ created, skipped }` summary. */
const writeFilesToDir = ({ baseDir, files, label }: { baseDir: string; files: [string, string][]; label: string }) => {
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true })
  let created = 0
  let skipped = 0
  for (const [name, content] of files) {
    const path = join(baseDir, name)
    if (writeIfNotExists({ content, label: `${label}/${name}`, path })) created += 1
    else skipped += 1
  }
  return { created, skipped }
}
export { camelToTitle, hasFlag, parseEnumFieldDef, readArgOrEqFlag, readEqFlag, writeFilesToDir, writeIfNotExists }
export type { ParseEnumFieldResult }
