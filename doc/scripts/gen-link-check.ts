#!/usr/bin/env bun
/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/* eslint-disable no-console */
import { readJson } from 'noboil/env-file'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOCS_DIR, REPO, slugify } from './lib'

const SLUG_RE = /\]\(\.\/(?<slug>[a-z][a-z0-9-]*)(?:#(?<anchor>[a-z][a-z0-9-]*))?\)/gu
const GITHUB_RE = /github\.com\/1qh\/noboil\/(?:blob|tree)\/main\/(?<path>[^\s)]+)/gu
const MDX_EXT_RE = /\.mdx$/u
const main = () => {
  // oxlint-disable-next-line node/no-sync
  const files = readdirSync(DOCS_DIR)
    .toSorted((a, b) => (a < b ? -1 : Number(a > b)))
    .filter(f => f.endsWith('.mdx'))
  const slugs = new Set(files.map(f => f.replace(MDX_EXT_RE, '')))
  const anchorsByFile = new Map<string, Set<string>>()
  for (const f of files) {
    // oxlint-disable-next-line node/no-sync
    const src = readFileSync(join(DOCS_DIR, f), 'utf8')
    const anchors = new Set<string>()
    for (const line of src.split('\n')) if (line.startsWith('#')) anchors.add(slugify(line))
    anchorsByFile.set(f.replace(MDX_EXT_RE, ''), anchors)
  }
  const failures: string[] = []
  const checkSlugs = (f: string, src: string) => {
    let m = SLUG_RE.exec(src)
    while (m) {
      const slug = m.groups?.slug
      const anchor = m.groups?.anchor
      if (slug && !slugs.has(slug)) failures.push(`${f}: dead link → ./${slug}`)
      else if (slug && anchor) {
        const targetAnchors = anchorsByFile.get(slug)
        if (targetAnchors && !targetAnchors.has(anchor)) failures.push(`${f}: dead anchor → ./${slug}#${anchor}`)
      }
      m = SLUG_RE.exec(src)
    }
  }
  const checkGithub = (f: string, src: string) => {
    let gm = GITHUB_RE.exec(src)
    while (gm) {
      const path = gm.groups?.path
      if (path) {
        const localPath = join(REPO, path)
        // oxlint-disable-next-line node/no-sync
        if (!existsSync(localPath)) failures.push(`${f}: dead github link → main/${path}`)
      }
      gm = GITHUB_RE.exec(src)
    }
  }
  for (const f of files) {
    // oxlint-disable-next-line node/no-sync
    const src = readFileSync(join(DOCS_DIR, f), 'utf8')
    checkSlugs(f, src)
    checkGithub(f, src)
  }
  const meta = readJson(`${DOCS_DIR}/meta.json`) as { pages: string[] }
  const navSet = new Set(meta.pages)
  const orphans = [...slugs].filter(s => !navSet.has(s))
  if (orphans.length > 0) failures.push(`Pages not in meta.json nav: ${orphans.join(', ')}`)
  if (failures.length > 0) {
    console.log(`✗ ${failures.length} link/nav issue(s):`)
    for (const fail of failures) console.log(`  ${fail}`)
    process.exit(1)
  }
  console.log(
    `Link check passed (${files.length} files, ${slugs.size} slugs, ${[...anchorsByFile.values()].reduce((s, a) => s + a.size, 0)} anchors)`
  )
}
main()
