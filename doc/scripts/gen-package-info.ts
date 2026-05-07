#!/usr/bin/env bun
/* eslint-disable no-console */
import { readJson } from 'noboil/env-file'
import { replaceLineBetween, REPO } from './lib'
const PKG = `${REPO}/lib/noboil/package.json`
interface Pkg {
  description: string
  keywords?: string[]
  name: string
  peerDependencies?: Record<string, string>
  version: string
}
const main = () => {
  const pkg = readJson(PKG) as Pkg
  const tagline = `**v${pkg.version}** · ${pkg.description}`
  const peers = pkg.peerDependencies
    ? `**Peer deps:** ${Object.keys(pkg.peerDependencies)
        .map(d => `\`${d}\``)
        .join(', ')}`
    : ''
  const block = peers ? `${tagline}\n\n${peers}` : tagline
  const target = `${REPO}/README.md`
  const dirty = replaceLineBetween(target, 'PACKAGE-INFO', block)
  console.log(dirty ? `Updated package info: v${pkg.version}` : `Package info up to date: v${pkg.version}`)
}
main()
