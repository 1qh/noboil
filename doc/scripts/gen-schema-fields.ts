#!/usr/bin/env bun
/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/* eslint-disable no-console, complexity */
import { readFileSync } from 'node:fs'
import { DOCS_DIR, replaceBetween, REPO } from './lib'

const SLOTS = ['base', 'children', 'kv', 'log', 'org', 'orgScoped', 'owned', 'quota', 'singleton'] as const
const escapeMd = (s: string): string =>
  s
    .replaceAll('|', String.raw`\|`)
    .replaceAll('{', String.raw`\{`)
    .replaceAll('}', String.raw`\}`)
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
const SLOT_RE = /^\s{2}(?<slot>\w+):\s*\{/u
const TABLE_RE = /^(?<indent>\s+)(?<name>\w+):\s*(?:object\(\{|child\(\{|\{|orgSchema)/u
// eslint-disable-next-line regexp/no-super-linear-backtracking, sonarjs/super-linear-regex -- matches one schema field line from trusted repo source; bounded non-adversarial input
const FIELD_RE = /^\s+(?<fname>\w+):\s*(?<ftype>.+?),?$/u
// eslint-disable-next-line sonarjs/super-linear-regex -- single character-class quantifier anchored at end; linear
const TRAILING_PUNCT_RE = /[,;]+$/u
const SKIP_KEYS = new Set([
  'durationMs',
  'foreignKey',
  'index',
  'keys',
  'limit',
  'parent',
  'parentSchema',
  'schema',
  'writeRole'
])
interface ScanState {
  currentSlot: string
  currentTable: string
  depth: number
  inSchema: boolean
  tableFields: Map<string, { fields: { name: string; type: string }[]; slot: string }>
  tableIndent: number
}
// eslint-disable-next-line sonarjs/cognitive-complexity -- line-by-line schema scanner state machine; branch-per-syntactic-form is irreducible
const scanLine = (st: ScanState, raw: string): void => {
  if (!st.inSchema) {
    if (raw.includes('schema({')) {
      st.inSchema = true
      st.depth = 1
    }
    return
  }
  for (const ch of raw)
    if (ch === '{' || ch === '(') st.depth += 1
    else if (ch === '}' || ch === ')') st.depth -= 1
  if (st.depth <= 0) {
    st.inSchema = false
    return
  }
  const slotMatch = SLOT_RE.exec(raw)
  if (slotMatch?.groups?.slot && SLOTS.includes(slotMatch.groups.slot as (typeof SLOTS)[number])) {
    st.currentSlot = slotMatch.groups.slot
    st.currentTable = ''
    return
  }
  const tableMatch = TABLE_RE.exec(raw)
  if (tableMatch?.groups?.indent && tableMatch.groups.name && tableMatch.groups.indent.length === 4 && st.currentSlot) {
    st.currentTable = tableMatch.groups.name
    st.tableIndent = tableMatch.groups.indent.length
    st.tableFields.set(st.currentTable, { fields: [], slot: st.currentSlot })
    return
  }
  if (st.currentTable) {
    const indent = raw.length - raw.trimStart().length
    if (indent <= st.tableIndent) {
      st.currentTable = ''
      return
    }
    const fieldMatch = FIELD_RE.exec(raw)
    if (fieldMatch?.groups?.fname && fieldMatch.groups.ftype && !SKIP_KEYS.has(fieldMatch.groups.fname)) {
      const t = fieldMatch.groups.ftype.trim().replace(TRAILING_PUNCT_RE, '')
      if (t && !t.startsWith('//') && !t.startsWith('object('))
        st.tableFields.get(st.currentTable)?.fields.push({ name: fieldMatch.groups.fname, type: t })
    }
  }
}
const renderTable = (name: string, fields: { name: string; type: string }[]): string[] => {
  const out = [`**\`${name}\`** — ${fields.length} field(s)`, '']
  if (fields.length === 0) out.push('_(no inline fields parsed — see source)_')
  else {
    out.push('| Field | Zod chain |', '|---|---|')
    for (const f of fields) out.push(`| \`${f.name}\` | \`${escapeMd(f.type)}\` |`)
  }
  out.push('')
  return out
}
const main = () => {
  // oxlint-disable-next-line node/no-sync
  const lines = readFileSync(`${REPO}/backend/convex/s.ts`, 'utf8').split('\n')
  const st: ScanState = {
    currentSlot: '',
    currentTable: '',
    depth: 0,
    inSchema: false,
    tableFields: new Map(),
    tableIndent: -1
  }
  for (const raw of lines) scanLine(st, raw)
  const { tableFields } = st
  const sections: string[] = []
  let totalTables = 0
  let totalFields = 0
  const bySlot = new Map<string, { fields: { name: string; type: string }[]; name: string }[]>()
  for (const [name, info] of tableFields) {
    const arr = bySlot.get(info.slot) ?? []
    arr.push({ fields: info.fields, name })
    bySlot.set(info.slot, arr)
  }
  for (const slot of SLOTS) {
    const tables = bySlot.get(slot)
    if (tables && tables.length > 0) {
      sections.push(`### slot: \`${slot}\``, '')
      for (const { fields, name } of tables.toSorted((a, b) => a.name.localeCompare(b.name))) {
        totalTables += 1
        totalFields += fields.length
        sections.push(...renderTable(name, fields))
      }
    }
  }
  const body = [
    `Auto-extracted from \`backend/convex/s.ts\`. **${totalTables} tables, ${totalFields} user-defined fields** (auto-injected fields like \`userId\`/\`updatedAt\` are added by factories — see [auto-fields](#schema-branding) above).`,
    '',
    ...sections
  ].join('\n')
  const target = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(target, 'SCHEMA-FIELDS', body)
  console.log(dirty ? `Updated schema fields (${totalTables} tables, ${totalFields} fields)` : 'Schema fields up to date')
}
main()
