#!/usr/bin/env bun
/* eslint-disable no-console */
import { walkFiles } from 'noboil/walk'
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { DOCS_DIR, replaceBetween, REPO, STRIP_AUTOGEN_RE, STRIP_FENCE_RE } from './lib'

const MIN_LEN = 120
const STRIP_HTML_AUTOGEN_RE = /<!-- AUTO-GENERATED:[\s\S]*?\/AUTO-GENERATED:[^>]+-->/gu
const walk = (dir: string): string[] => walkFiles(dir, { accept: name => name.endsWith('.mdx') })
const splitParas = (src: string): string[] => {
  const cleaned = src.replaceAll(STRIP_AUTOGEN_RE, '').replaceAll(STRIP_HTML_AUTOGEN_RE, '').replaceAll(STRIP_FENCE_RE, '')
  return cleaned
    .split('\n\n')
    .map(p => p.trim().replaceAll(/\s+/gu, ' '))
    .filter(p => p.length >= MIN_LEN && !p.startsWith('---') && !p.startsWith('|'))
}
interface Dupe {
  files: string[]
  paragraph: string
}
const collectDupes = (files: string[]): Dupe[] => {
  const paraToFiles = new Map<string, Set<string>>()
  for (const file of files) {
    const rel = relative(REPO, file)
    // oxlint-disable-next-line node/no-sync
    for (const p of splitParas(readFileSync(file, 'utf8'))) {
      const set = paraToFiles.get(p) ?? new Set<string>()
      set.add(rel)
      paraToFiles.set(p, set)
    }
  }
  const dupes: Dupe[] = []
  for (const [paragraph, fileSet] of paraToFiles)
    if (fileSet.size > 1) dupes.push({ files: [...fileSet].toSorted((a, b) => (a < b ? -1 : Number(a > b))), paragraph })
  dupes.sort((a, b) => b.paragraph.length - a.paragraph.length)
  return dupes
}
const renderDupe = (d: Dupe): string[] => {
  const fileList = d.files.map(f => `\`${f}\``).join(' + ')
  const excerpt = `${d.paragraph.slice(0, 200)}${d.paragraph.length > 200 ? '…' : ''}`
  return ['', `- in ${fileList}:`, `  > ${excerpt}`]
}
const renderReport = (dupes: Dupe[], fileCount: number): string => {
  const lines: string[] = [
    `Scans every \`.mdx\` for paragraphs ≥${MIN_LEN} chars appearing in 2+ files. Catches accidental duplication that adds maintenance cost without adding info.`,
    '',
    `**${dupes.length} duplicate paragraph(s) found** (across ${fileCount} doc files).`
  ]
  if (dupes.length > 0) {
    lines.push('')
    for (const d of dupes.slice(0, 20)) lines.push(...renderDupe(d))
    if (dupes.length > 20) lines.push(`\n_(showing first 20 of ${dupes.length})_`)
  } else lines.push('', '_No duplicates above threshold — every long paragraph appears in exactly one file._')
  return lines.join('\n')
}
const main = () => {
  const files = walk(DOCS_DIR)
  const dupes = collectDupes(files)
  const body = renderReport(dupes, files.length)
  const archTarget = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(archTarget, 'DOC-DEDUP', body)
  console.log(dirty ? `Updated doc dedup check (${dupes.length} dupes)` : `Doc dedup up to date (${dupes.length})`)
}
main()
