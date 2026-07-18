#!/usr/bin/env bun
/* eslint-disable no-console, no-template-curly-in-string */
import { readFileSync } from 'node:fs'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween } from './lib'

const STDB = `${LIB_NOBOIL}/src/spacetimedb/server`
// eslint-disable-next-line sonarjs/super-linear-regex -- matches one trimmed source line from trusted repo source; bounded non-adversarial input
const NAME_RE = /(?<role>\w+)Name\s*=\s*`(?<tpl>[^`]+)`/u
// eslint-disable-next-line regexp/no-super-linear-backtracking, sonarjs/super-linear-regex -- matches one trimmed JSDoc line from trusted repo source; bounded non-adversarial input
const JSDOC_RE = /^\s*\/\*\*\s*(?<text>.+?)\s*\*\/\s*$/u
// eslint-disable-next-line regexp/no-super-linear-backtracking, sonarjs/super-linear-regex -- matches one trimmed JSDoc params line from trusted repo source; bounded non-adversarial input
const PARAMS_RE = /^\[params:\s+(?<params>.+?)\]\s+(?<desc>.+)$/u
interface Entry {
  desc: string
  params: string
  role: string
  tpl: string
}
const extract = (file: string): Entry[] => {
  const out: Entry[] = []
  // oxlint-disable-next-line node/no-sync
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  let pendingDoc = ''
  for (const line of lines) {
    const docMatch = JSDOC_RE.exec(line)
    if (docMatch?.groups?.text) pendingDoc = docMatch.groups.text
    else {
      const m = NAME_RE.exec(line)
      if (m?.groups?.role && m.groups.tpl) {
        const pm = PARAMS_RE.exec(pendingDoc)
        const params = pm?.groups?.params ?? ''
        const desc = pm?.groups?.desc ?? pendingDoc
        out.push({ desc, params, role: m.groups.role, tpl: m.groups.tpl })
        pendingDoc = ''
      } else if (line.trim() && !line.trim().startsWith('//')) pendingDoc = ''
    }
  }
  return out
}
const factoryRows = (factory: string, names: Entry[]): string[] => {
  if (names.length === 0) return [`| \`${factory}\` | _(none)_ | _(none)_ | _(none)_ |`]
  return names.map((n, i) => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal placeholder to replace
    const tpl = `\`${n.tpl.replaceAll('${tableName}', '{table}')}\``
    const escapedParams = n.params.replaceAll('|', String.raw`\|`)
    const params = n.params ? `\`${escapedParams}\`` : ''
    const desc = n.desc.replaceAll('|', String.raw`\|`)
    const label = i === 0 ? `\`${factory}\`` : ' '
    return `| ${label} | ${tpl} | ${params} | ${desc} |`
  })
}
const main = () => {
  const log = extract(`${STDB}/log.ts`)
  const kv = extract(`${STDB}/kv.ts`)
  const quota = extract(`${STDB}/quota.ts`)
  const table = [
    '| Factory | Reducer | Parameters | Description |',
    '|---|---|---|---|',
    ...factoryRows('log', log),
    ...factoryRows('kv', kv),
    ...factoryRows('quota', quota)
  ].join('\n')
  const target = `${DOCS_DIR}/api-reference.mdx`
  const dirty = replaceBetween(target, 'STDB-FACTORY-REDUCERS', table)
  console.log(
    dirty
      ? `Updated stdb factory reducer names (log:${log.length}, kv:${kv.length}, quota:${quota.length})`
      : 'Stdb factory reducer names up to date'
  )
}
main()
