#!/usr/bin/env bun
/** biome-ignore-all lint/performance/noAwaitInLoops: sequential CLI spawns */
/** biome-ignore-all lint/suspicious/noControlCharactersInRegex: ANSI escape stripping */
/* oxlint-disable eslint(no-await-in-loop), eslint(no-control-regex), eslint-plugin-unicorn(no-hex-escape), eslint-plugin-unicorn(no-immediate-mutation) */
/* eslint-disable no-console */
import { $ } from 'bun'
import { stripAnsi } from 'noboil/ansi'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LIB_NOBOIL } from './lib'
const BIN = `${LIB_NOBOIL}/src/index.ts`
const CONVEX_BIN = `${LIB_NOBOIL}/src/convex/cli.ts`
const STDB_BIN = `${LIB_NOBOIL}/src/spacetimedb/cli.ts`
const mdxPath = resolve(import.meta.dir, '../content/docs/cli.mdx')
const START = '{/* AUTO-GENERATED:HELP:START */}'
const END = '{/* AUTO-GENERATED:HELP:END */}'
const runHelp = async (bin: string, args: string[]): Promise<string> => {
  const proc = await $`bun ${bin} ${args} --help`.quiet().nothrow()
  return stripAnsi(proc.stdout.toString()).trim()
}
const codeBlock = (title: string, body: string): string => `**${title}**\n\n\`\`\`text\n${body}\n\`\`\``
const main = async () => {
  const items: { args: string[]; bin: string; label: string }[] = [
    { args: [], bin: BIN, label: 'noboil --help' },
    ...['init', 'doctor', 'status', 'sync', 'eject', 'upgrade'].map(cmd => ({
      args: [cmd],
      bin: BIN,
      label: `noboil ${cmd} --help`
    })),
    { args: [], bin: CONVEX_BIN, label: 'noboil convex --help' },
    { args: ['add'], bin: CONVEX_BIN, label: 'noboil convex add --help' },
    { args: [], bin: STDB_BIN, label: 'noboil stdb --help' },
    { args: ['add'], bin: STDB_BIN, label: 'noboil stdb add --help' }
  ]
  const blocks = await Promise.all(items.map(async i => codeBlock(i.label, await runHelp(i.bin, i.args))))
  const section = `\n${blocks.join('\n\n')}\n`
  const mdx = readFileSync(mdxPath, 'utf8')
  const startIdx = mdx.indexOf(START)
  const endIdx = mdx.indexOf(END)
  if (startIdx === -1 || endIdx === -1) {
    console.error(`Missing markers in ${mdxPath}. Add:\n${START}\n${END}`)
    process.exit(1)
  }
  const updated = mdx.slice(0, startIdx + START.length) + section + mdx.slice(endIdx)
  if (updated === mdx) console.log('cli.mdx help section already up to date')
  else if (process.argv.includes('--check')) console.log('Updated cli.mdx help section (drift)')
  else {
    writeFileSync(mdxPath, updated)
    console.log('Updated cli.mdx help section')
  }
}
await main()
