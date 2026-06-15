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
const main = () => {
  const files = walk(DOCS_DIR)
  const paraToFiles = new Map<string, Set<string>>()
  for (const file of files) {
    const rel = relative(REPO, file)
    for (const p of splitParas(readFileSync(file, 'utf8'))) {
      const set = paraToFiles.get(p) ?? new Set<string>()
      set.add(rel)
      paraToFiles.set(p, set)
    }
  }
  const dupes: { files: string[]; paragraph: string }[] = []
  for (const [paragraph, fileSet] of paraToFiles)
    if (fileSet.size > 1) dupes.push({ files: [...fileSet].toSorted(), paragraph })
  dupes.sort((a, b) => b.paragraph.length - a.paragraph.length)
  const lines: string[] = [
    `Scans every \`.mdx\` for paragraphs ≥${MIN_LEN} chars appearing in 2+ files. Catches accidental duplication that adds maintenance cost without adding info.`,
    '',
    `**${dupes.length} duplicate paragraph(s) found** (across ${files.length} doc files).`
  ]
  if (dupes.length > 0) {
    lines.push('')
    for (const d of dupes.slice(0, 20))
      lines.push(
        '',
        `- in ${d.files.map(f => `\`${f}\``).join(' + ')}:`,
        `  > ${d.paragraph.slice(0, 200)}${d.paragraph.length > 200 ? '…' : ''}`
      )
    if (dupes.length > 20) lines.push(`\n_(showing first 20 of ${dupes.length})_`)
  } else lines.push('', '_No duplicates above threshold — every long paragraph appears in exactly one file._')
  const body = lines.join('\n')
  const archTarget = `${DOCS_DIR}/architecture.mdx`
  const dirty = replaceBetween(archTarget, 'DOC-DEDUP', body)
  console.log(dirty ? `Updated doc dedup check (${dupes.length} dupes)` : `Doc dedup up to date (${dupes.length})`)
}
main()
