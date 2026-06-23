import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const LIB = resolve(import.meta.dirname, '..')
const walk = (dir: string, out: string[] = []): string[] => {
  // oxlint-disable-next-line node/no-sync
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(full)
  }
  return out
}
const FORBIDDEN_IMPORTS = [/from '\.\.\/[a-z][a-zA-Z]*\//u]
const FORBIDDEN_TOKENS = ['clamav', 'corpus', 'gvisor', 'kimi', 'nomic', 'ollama', 'runsc']
const FORBIDDEN_TOKEN_RES = FORBIDDEN_TOKENS.map(t => ({ re: new RegExp(`\\b${t}\\b`, 'iu'), token: t }))
describe('framework boundary — tools/ imports nothing project-specific', () => {
  // oxlint-disable-next-line node/no-sync
  const files = walk(LIB).filter(f => statSync(f).isFile())
  it.each(files)('%s has no project-side imports', file => {
    // oxlint-disable-next-line node/no-sync
    const src = readFileSync(file, 'utf8')
    for (const pat of FORBIDDEN_IMPORTS)
      expect(pat.test(src), `${file.replace(LIB, 'tools')} imports from project scope (matched ${pat.source})`).toBeFalsy()
  })
  it.each(files)('%s contains no consumer-domain tokens', file => {
    // oxlint-disable-next-line node/no-sync
    const src = readFileSync(file, 'utf8')
    for (const { re, token } of FORBIDDEN_TOKEN_RES)
      expect(re.test(src), `${file.replace(LIB, 'tools')} references '${token}'`).toBeFalsy()
  })
})
