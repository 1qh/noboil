#!/usr/bin/env bun
/* eslint-disable no-console */
import { rules as cvxRules } from '../../lib/noboil/src/convex/eslint'
import { rules as stdbRules } from '../../lib/noboil/src/spacetimedb/eslint'
import { DOCS_DIR, replaceBetween } from './lib'

const escapeMd = (s: string): string =>
  s
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', String.raw`\|`)
    .replaceAll('{', String.raw`\{`)
    .replaceAll('}', String.raw`\}`)
    .replaceAll('\n', ' ')
const firstMessage = (rule: { meta: { messages: Record<string, string> } }): string => {
  const msgs = Object.values(rule.meta.messages)
  return msgs[0] ?? ''
}
const main = () => {
  const cvxNames = Object.keys(cvxRules).toSorted((a, b) => (a < b ? -1 : Number(a > b)))
  const stdbNames = Object.keys(stdbRules).toSorted((a, b) => (a < b ? -1 : Number(a > b)))
  const all = [...new Set([...cvxNames, ...stdbNames])].toSorted((a, b) => (a < b ? -1 : Number(a > b)))
  const rows = all.map(name => {
    const inCvx = cvxNames.includes(name)
    const inStdb = stdbNames.includes(name)
    const rule =
      (cvxRules as Record<string, { meta: { messages: Record<string, string> } }>)[name] ??
      (stdbRules as Record<string, { meta: { messages: Record<string, string> } }>)[name]
    const desc = rule ? escapeMd(firstMessage(rule)) : ''
    return `| \`${name}\` | ${inCvx ? '✓' : '—'} | ${inStdb ? '✓' : '—'} | ${desc} |`
  })
  const body = ['| Rule | Convex | SpacetimeDB | Message |', '|---|---|---|---|', ...rows].join('\n')
  const target = `${DOCS_DIR}/api-reference.mdx`
  const dirty = replaceBetween(target, 'ESLINT-RULES', body)
  console.log(
    dirty
      ? `Updated ESLint rules table (cvx:${cvxNames.length}, stdb:${stdbNames.length}, total:${all.length})`
      : `ESLint rules table up to date (cvx:${cvxNames.length}, stdb:${stdbNames.length}, total:${all.length})`
  )
}
main()
