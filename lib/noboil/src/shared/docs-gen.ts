import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { green } from '../ansi'

const reExportPat =
  /export\s+(?<typeKw>type\s+)?\{\s*(?<sym>(?:default\s+as\s+)?\w+)\s*\}\s*from\s*['"](?<src>[^'"]+)['"]/gu
const tsExtPat = /\.ts$/u
const jsdocStarPat = /^[ \t]*\*[ \t]?/gmu
const resolveReExports = (
  indexContent: string
): { isDefault: boolean; isType: boolean; sourcePath: string; symbol: string }[] => {
  const results: { isDefault: boolean; isType: boolean; sourcePath: string; symbol: string }[] = []
  let m = reExportPat.exec(indexContent)
  while (m) {
    const raw = m.groups?.sym ?? ''
    const src = m.groups?.src ?? ''
    const isType = (m.groups?.typeKw ?? '').trim() === 'type'
    const isDefault = raw.startsWith('default as')
    const symbol = isDefault ? raw.replace('default as ', '').trim() : raw.trim()
    if (symbol && src) results.push({ isDefault, isType, sourcePath: src, symbol })
    m = reExportPat.exec(indexContent)
  }
  reExportPat.lastIndex = 0
  return results
}
const extractJSDoc = (fileContent: string, symbolName: string): string => {
  const escaped = symbolName.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)
  const patterns = [
    new RegExp(`/\\*\\*([\\s\\S]*?)\\*/\\s*(?:export\\s+)?const\\s+${escaped}\\b`, 'u'),
    new RegExp(`/\\*\\*([\\s\\S]*?)\\*/\\s*(?:export\\s+)?interface\\s+${escaped}\\b`, 'u'),
    new RegExp(`/\\*\\*([\\s\\S]*?)\\*/\\s*(?:export\\s+)?type\\s+${escaped}\\b`, 'u')
  ]
  for (const pat of patterns) {
    const match = pat.exec(fileContent)
    if (match?.[1]) {
      const raw = match[1].replace(jsdocStarPat, '').trim()
      if (raw) return raw
    }
  }
  return ''
}
const FIELD_PAT = /^[ \t]*(?<field>\w+)[ \t]*[:(]/gmu
const extractConstSignature = (match: RegExpExecArray): string => {
  const annotation = match[1]?.trim()
  if (annotation) return annotation
  const rhs = match[2]?.trim() ?? ''
  const arrowIdx = rhs.indexOf('=>')
  if (arrowIdx > 0) {
    const params = rhs.slice(0, arrowIdx).trim()
    if (params.startsWith('(')) return `${params} => ...`
  }
  return ''
}
const extractInterfaceKeys = (body: string): string => {
  const keys: string[] = []
  FIELD_PAT.lastIndex = 0
  let fm = FIELD_PAT.exec(body)
  while (fm) {
    if (fm.groups?.field) keys.push(fm.groups.field)
    fm = FIELD_PAT.exec(body)
  }
  return keys.length > 0 ? `{ ${keys.join(', ')} }` : ''
}
const extractSignature = (fileContent: string, symbolName: string): string => {
  const escaped = symbolName.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)
  const constPat = new RegExp(`const\\s+${escaped}\\s*(?::\\s*([^=]+))?=\\s*(.+)`, 'u')
  const constMatch = constPat.exec(fileContent)
  if (constMatch) {
    const sig = extractConstSignature(constMatch)
    if (sig) return sig
  }
  const ifacePat = new RegExp(`interface\\s+${escaped}\\s*\\{([^}]*)\\}`, 'u')
  const ifaceMatch = ifacePat.exec(fileContent)
  if (ifaceMatch?.[1]) return extractInterfaceKeys(ifaceMatch[1])
  return ''
}
interface ReExport {
  isDefault: boolean
  isType: boolean
  sourcePath: string
  symbol: string
}
const exportKind = (re: ReExport): string => {
  if (re.isType) return 'type'
  if (re.isDefault) return 'default'
  return 'named'
}
const buildExportRow = (re: ReExport, indexPath: string, indexContent: string): string => {
  const sourceFile = join(dirname(indexPath), `${re.sourcePath.replace(tsExtPat, '')}.ts`)
  let doc = ''
  let sig = ''
  // oxlint-disable-next-line node/no-sync
  if (existsSync(sourceFile)) {
    // oxlint-disable-next-line node/no-sync
    const src = readFileSync(sourceFile, 'utf8')
    doc = extractJSDoc(src, re.symbol)
    sig = extractSignature(src, re.symbol)
  }
  if (!doc) doc = extractJSDoc(indexContent, re.symbol)
  if (!sig) sig = extractSignature(indexContent, re.symbol)
  const sigCell = sig ? `\`${sig}\`` : ''
  return `| \`${re.symbol}\` | ${exportKind(re)} | ${doc} | ${sigCell} |`
}
const processEntryPoint = (ep: { label: string; path: string }, srcDir: string, lines: string[]): number => {
  const indexPath = join(srcDir, ep.path)
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(indexPath)) return 0
  // oxlint-disable-next-line node/no-sync
  const indexContent = readFileSync(indexPath, 'utf8')
  const reExports = resolveReExports(indexContent)
  if (reExports.length === 0) return 0
  lines.push(
    `## ${ep.label}`,
    '',
    '| Export | Kind | Description | Signature |',
    '|--------|------|-------------|-----------|'
  )
  let count = 0
  for (const re of reExports) {
    lines.push(buildExportRow(re, indexPath, indexContent))
    count += 1
  }
  lines.push('')
  return count
}
export { extractJSDoc, extractSignature, green, processEntryPoint, resolveReExports }
