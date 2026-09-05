#!/usr/bin/env bun
/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/* eslint-disable no-console */
import { readJson } from 'noboil/env-file'
import { DOCS_DIR, PKG_JSON_PATH, replaceBetween } from './lib'

const escapeMd = (s: string): string =>
  s.replaceAll('|', String.raw`\|`).replaceAll('{', String.raw`\{`).replaceAll('}', String.raw`\}`)
interface ExportTarget {
  default?: string
  import?: string
  require?: string
  types?: string
}
const main = () => {
  const pkg = readJson(PKG_JSON_PATH) as {
    exports: Record<string, ExportTarget | string>
    name: string
  }
  const entries = Object.entries(pkg.exports).toSorted(([a], [b]) => a.localeCompare(b))
  const rows = entries.map(([sub, tgt]) => {
    const path = sub === '.' ? pkg.name : `${pkg.name}/${sub.replace('./', '')}`
    if (typeof tgt === 'string') return `| \`${path}\` | \`${escapeMd(tgt)}\` | — |`
    const main2 = tgt.import ?? tgt.default ?? tgt.require ?? ''
    const types = tgt.types ?? ''
    return `| \`${path}\` | \`${escapeMd(main2)}\` | \`${escapeMd(types)}\` |`
  })
  const body = [
    `**${entries.length} subpath exports** from \`noboil\` package.json. Use exact import paths for tree-shaking.`,
    '',
    '| Import path | Runtime entry | Types entry |',
    '|---|---|---|',
    ...rows
  ].join('\n')
  const target = `${DOCS_DIR}/api-reference.mdx`
  const dirty = replaceBetween(target, 'PACKAGE-EXPORTS', body)
  console.log(dirty ? `Updated package exports (${entries.length})` : `Package exports up to date (${entries.length})`)
}
main()
