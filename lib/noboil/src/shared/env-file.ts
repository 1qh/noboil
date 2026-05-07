/** biome-ignore-all lint/nursery/noContinue: line skip on comments/empty */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
/** Parse a single `KEY=VALUE` line. Returns null on comment/empty/malformed. Strips surrounding quotes. */
const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const eq = trimmed.indexOf('=')
  if (eq < 1) return null
  const key = trimmed.slice(0, eq).trim()
  let value = trimmed.slice(eq + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    value = value.slice(1, -1).trim()
  return [key, value]
}
/** Parse a `.env` file into `Record<string,string>`. Returns `{}` on missing file. Strips quotes, ignores comments. */
const parseEnvFile = (path: string): Record<string, string> => {
  const vars: Record<string, string> = {}
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return vars
  }
  for (const line of text.split('\n')) {
    const parsed = parseEnvLine(line)
    if (parsed) vars[parsed[0]] = parsed[1]
  }
  return vars
}
const hasMarkers = (dir: string, markers: readonly string[]): boolean => markers.every(m => existsSync(join(dir, m)))
/** Walk up from `start` looking for any directory that contains all `markers` (default: `package.json`). */
const findProjectRoot = (start = process.cwd(), markers: readonly string[] = ['package.json']): string => {
  let dir = start
  for (let i = 0; i < 30; i += 1) {
    if (hasMarkers(dir, markers)) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return start
}
/** Read + parse JSON file. Throws on read or parse failure. Cast result at callsite. */
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))
/** Write `value` as pretty-printed JSON with trailing newline. */
const writeJson = (path: string, value: unknown): void => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
/** Read + parse JSON file, returning null on any failure. Cast result at callsite. */
const readJsonSafe = (path: string): unknown => {
  try {
    return readJson(path)
  } catch {
    return null
  }
}
export { findProjectRoot, parseEnvFile, parseEnvLine, readJson, readJsonSafe, writeJson }
