#!/usr/bin/env bun
/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { DOCS_DIR, replaceBetween } from './lib'

const escapeMd = (s: string): string =>
  s
    .replaceAll('|', String.raw`\|`)
    .replaceAll('{', String.raw`\{`)
    .replaceAll('}', String.raw`\}`)
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
const OPTIONS_HEADER_RE = /^\s*Options:\s*$/u
const UPPER_START_RE = /^[A-Z]/u
const FLAG_RE = /^\s{2,}(?<flag>(?:--[\w-]+|-\w)(?:[=,\s][^\s][^\s]*)*)\s{2,}(?<desc>\S.*)$/u
const COMMAND_RE = /\*\*(?<cmd>noboil(?: \w+)?(?: \w+)?(?: --help)?)\*\*\n+```text\n(?<body>[\s\S]*?)\n```/gu
interface Flag {
  description: string
  flag: string
}
const parseHelpBlock = (text: string): Flag[] => {
  const flags: Flag[] = []
  let inOpts = false
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (OPTIONS_HEADER_RE.test(line)) inOpts = true
    else {
      if (UPPER_START_RE.test(line.trim()) && line.trim().endsWith(':')) inOpts = line.trim() === 'Options:'
      if (inOpts) {
        const m = FLAG_RE.exec(line)
        if (m?.groups?.desc && m.groups.flag) flags.push({ description: m.groups.desc.trim(), flag: m.groups.flag.trim() })
      }
    }
  }
  return flags
}
const main = () => {
  // oxlint-disable-next-line node/no-sync
  const src = readFileSync(`${DOCS_DIR}/cli.mdx`, 'utf8')
  const sections: string[] = []
  let total = 0
  let m = COMMAND_RE.exec(src)
  while (m) {
    if (m.groups?.body && m.groups.cmd) {
      const flags = parseHelpBlock(m.groups.body)
      if (flags.length > 0) {
        total += flags.length
        sections.push(
          `**\`${m.groups.cmd.replace(' --help', '')}\`** — ${flags.length} option(s)`,
          '',
          '| Flag | Description |',
          '|---|---|'
        )
        for (const f of flags) sections.push(`| \`${escapeMd(f.flag)}\` | ${escapeMd(f.description)} |`)
        sections.push('')
      }
    }
    m = COMMAND_RE.exec(src)
  }
  COMMAND_RE.lastIndex = 0
  const body = [`Parsed flag tables for every \`--help\` block above. **${total} flags total.**`, '', ...sections].join(
    '\n'
  )
  const dirty = replaceBetween(`${DOCS_DIR}/cli.mdx`, 'CLI-FLAGS', body)
  console.log(dirty ? `Updated CLI flag tables (${total} flags)` : `CLI flag tables up to date (${total} flags)`)
}
main()
