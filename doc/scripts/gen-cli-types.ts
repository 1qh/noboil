#!/usr/bin/env bun
/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { LIB_NOBOIL, replaceLineBetween, REPO } from './lib'

const TYPE_RE = /type TableType = (?<types>(?:'\w+'(?:\s*\|\s*)?)+)/u
const main = () => {
  // oxlint-disable-next-line node/no-sync
  const cvxAdd = readFileSync(`${LIB_NOBOIL}/src/shared/types.ts`, 'utf8')
  const m = TYPE_RE.exec(cvxAdd)
  if (!m?.groups?.types) throw new Error('TableType union not found in shared/types.ts')
  const types = [...m.groups.types.matchAll(/'(?<word>\w+)'/gu)].flatMap(t =>
    t.groups?.word === undefined ? [] : [t.groups.word]
  )
  const sample = types.includes('owned') ? 'owned' : (types[0] ?? 'owned')
  const list = types.join(', ')
  const example = `\`noboil add post --type=${sample} --fields="title:string,content:string"\``
  const target = `${REPO}/README.md`
  const tagline = `\`noboil init my-app --db=convex\`, ${example}, etc. (Valid \`--type=\` values: ${list}.) Run \`noboil <cmd> --help\` for options.`
  const dirty = replaceLineBetween(target, 'CLI-TABLE-TYPES', tagline)
  console.log(dirty ? `Updated CLI table types: ${list}` : 'CLI table types up to date')
}
main()
