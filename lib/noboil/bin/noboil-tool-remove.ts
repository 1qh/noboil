#!/usr/bin/env bun
/* eslint-disable no-console */
/* oxlint-disable eslint-plugin-unicorn(no-process-exit) */
/** biome-ignore-all lint/style/useFilenamingConvention: script */
import { $ } from 'bun'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
const run = async (argv: string[] = process.argv.slice(2)): Promise<void> => {
  const pathArg = argv[0]
  if (!pathArg) {
    console.error('usage: noboil tool remove <provider>/<...segments>')
    console.error('  example: noboil tool remove exim/hscode/detail')
    process.exit(2)
  }
  const parts = pathArg.split('/').filter(Boolean)
  if (parts.length < 2) {
    console.error('need at least <provider>/<name>')
    process.exit(2)
  }
  const name = parts.at(-1) ?? ''
  const dir = parts.slice(0, -1).join('/')
  const toolFile = join('convex/tools', dir, `${name}.ts`)
  const testFile = join('convex/tools', dir, `${name}.integration.test.ts`)
  let removed = 0
  for (const f of [toolFile, testFile])
    if (existsSync(f)) {
      rmSync(f)
      console.log(`removed ${f}`)
      removed += 1
    }
  if (removed === 0) {
    console.error(`no files found for ${pathArg}`)
    process.exit(1)
  }
  console.log('regenerating codegen…')
  await $`bun run build-cli`.nothrow()
  console.log('done.')
}
if (import.meta.main) await run()
export { run }
