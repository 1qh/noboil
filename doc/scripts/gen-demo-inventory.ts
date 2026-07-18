#!/usr/bin/env bun
/* eslint-disable no-console */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { replaceLineBetween, REPO } from './lib'

const dbDescription: Record<string, string> = {
  cvx: 'Convex',
  stdb: 'SpacetimeDB'
}
const collect = (kind: 'cvx' | 'stdb'): string[] => {
  const root = join(REPO, 'web', kind)
  const entries: string[] = []
  // oxlint-disable-next-line node/no-sync
  for (const name of readdirSync(root).toSorted((a, b) => (a < b ? -1 : Number(a > b)))) {
    const dir = join(root, name)
    // oxlint-disable-next-line node/no-sync
    if (statSync(dir).isDirectory() && readFileSync(join(dir, 'package.json'), 'utf8').includes('"name"'))
      entries.push(name)
  }
  return entries.toSorted((a, b) => (a < b ? -1 : Number(a > b)))
}
const main = () => {
  const cvx = collect('cvx')
  const stdb = collect('stdb')
  const both = [...new Set([...cvx, ...stdb])].toSorted((a, b) => (a < b ? -1 : Number(a > b)))
  const list = both.join(', ')
  const tagline = `${both.length} vertical demos (${list})`
  const tree = `    cvx/              ${cvx.length} ${dbDescription.cvx} demo web apps (${cvx.join(', ')})\n    stdb/             ${stdb.length} ${dbDescription.stdb} demo web apps (${stdb.join(', ')})`
  const readme = join(REPO, 'README.md')
  let dirty = false
  if (replaceLineBetween(readme, 'DEMO-COUNT', tagline)) dirty = true
  if (replaceLineBetween(readme, 'DEMO-TREE', tree)) dirty = true
  console.log(dirty ? `Updated demo inventory: ${tagline}` : 'Demo inventory already up to date')
}
main()
