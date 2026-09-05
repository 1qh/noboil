#!/usr/bin/env bun
/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/* eslint-disable no-console */
import { readJson } from 'noboil/env-file'
import { PKG_JSON_PATH, replaceLineBetween, REPO } from './lib'

const PKG = PKG_JSON_PATH
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
