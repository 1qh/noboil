#!/usr/bin/env bun
/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { DOCS_DIR, LIB_NOBOIL, replaceBetween } from './lib'

const CVX = `${LIB_NOBOIL}/src/convex/server`
const ENDPOINT_RE = /^\s*const\s+(?<name>\w+)\s*=\s*b\.(?<kind>[qm])\(/u
const RETURN_RE = /return\s+typed\(\{(?<body>[^}]+)\}\)/u
// eslint-disable-next-line sonarjs/super-linear-regex -- single greedy quantifier anchored at end; linear
const TYPE_ANNOTATION_RE = /:.+$/u
const extract = (file: string): { kind: 'm' | 'q'; name: string }[] => {
  // oxlint-disable-next-line node/no-sync
  const src = readFileSync(file, 'utf8')
  const out: { kind: 'm' | 'q'; name: string }[] = []
  for (const line of src.split('\n')) {
    const m = ENDPOINT_RE.exec(line)
    if (m?.groups?.name && m.groups.kind) out.push({ kind: m.groups.kind as 'm' | 'q', name: m.groups.name })
  }
  const rm = RETURN_RE.exec(src)
  if (!rm?.groups?.body) return out
  const exported = new Set<string>()
  for (const part of rm.groups.body.split(',')) {
    const trimmed = part.trim().replace(TYPE_ANNOTATION_RE, '').trim()
    if (trimmed) exported.add(trimmed)
  }
  return out.filter(e => exported.has(e.name))
}
const formatRow = (factory: string, names: { kind: 'm' | 'q'; name: string }[]): string => {
  const cells = names
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map(n => `\`${n.name}\` (${n.kind === 'q' ? 'query' : 'mutation'})`)
    .join(', ')
  return `| \`${factory}\` | ${cells || '_(none)_'} |`
}
const main = () => {
  const log = extract(`${CVX}/log.ts`)
  const kv = extract(`${CVX}/kv.ts`)
  const quota = extract(`${CVX}/quota.ts`)
  const table = [
    '| Factory | Convex-generated endpoints |',
    '|---|---|',
    formatRow('log', log),
    formatRow('kv', kv),
    formatRow('quota', quota)
  ].join('\n')
  const target = `${DOCS_DIR}/api-reference.mdx`
  const dirty = replaceBetween(target, 'CVX-FACTORY-ENDPOINTS', table)
  console.log(
    dirty
      ? `Updated cvx factory endpoints (log:${log.length}, kv:${kv.length}, quota:${quota.length})`
      : 'Cvx factory endpoints up to date'
  )
}
main()
