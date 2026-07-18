#!/usr/bin/env bun
/* eslint-disable no-console */
import { readdirSync, statSync } from 'node:fs'
import { DOCS_DIR, replaceBetween, REPO } from './lib'

const main = () => {
  const root = `${REPO}/readonly/ui/src/components`
  // oxlint-disable-next-line node/no-sync
  const top = readdirSync(root)
    .toSorted((a, b) => (a < b ? -1 : Number(a > b)))
    .filter(f => f.endsWith('.tsx'))
    .map(f => f.slice(0, -'.tsx'.length))
    .toSorted((a, b) => (a < b ? -1 : Number(a > b)))
  // oxlint-disable-next-line node/no-sync
  const subdirs = readdirSync(root)
    .toSorted((a, b) => (a < b ? -1 : Number(a > b)))
    // oxlint-disable-next-line node/no-sync
    .filter(f => statSync(`${root}/${f}`).isDirectory())
    .toSorted((a, b) => (a < b ? -1 : Number(a > b)))
  const subLines: string[] = []
  for (const sub of subdirs) {
    // oxlint-disable-next-line node/no-sync
    const items = readdirSync(`${root}/${sub}`)
      .toSorted((a, b) => (a < b ? -1 : Number(a > b)))
      .filter(f => f.endsWith('.tsx'))
      .map(f => f.slice(0, -'.tsx'.length))
      .toSorted((a, b) => (a < b ? -1 : Number(a > b)))
    if (items.length > 0) {
      const itemList = items.map(i => `\`${i}\``).join(', ')
      subLines.push(`- **${sub}** (${items.length}): ${itemList}`)
    }
  }
  const list = top.map(c => `\`${c}\``).join(', ')
  const body = [`**${top.length} top-level components:** ${list}`, '', ...subLines].join('\n')
  const target = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(target, 'UI-COMPONENTS', body)
  console.log(dirty ? `Updated UI components list (${top.length})` : `UI components list up to date (${top.length})`)
}
main()
