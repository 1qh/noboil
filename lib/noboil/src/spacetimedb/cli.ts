#!/usr/bin/env bun
/* eslint-disable no-console */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { bold, dim, red } from '../ansi'
const COMMANDS: Record<string, { description: string; script: string }> = {
  add: { description: 'Add a new table/reducer to your project', script: 'add.ts' },
  check: { description: 'Validate schema/reducer consistency', script: 'check.ts' },
  dev: { description: 'Start integrated local development workflow', script: '' },
  docs: { description: 'Generate API documentation', script: 'docs-gen.ts' },
  doctor: { description: 'Run project diagnostics', script: 'doctor.ts' },
  generate: { description: 'Generate project files (docker-compose, etc.)', script: '' },
  migrate: { description: 'Schema diff and publish migration plans', script: 'migrate.ts' },
  use: { description: 'Switch SpacetimeDB target (local / cloud)', script: '' },
  validate: { description: 'Lint schema, reducers, indexes, and access control', script: 'check.ts' },
  viz: { description: 'Visualize schema relationships', script: 'viz.ts' }
}
const printHelp = () => {
  console.log(`\n${bold('noboil stdb')} — Zod schema → fullstack app\n`)
  console.log(bold('Usage:'))
  console.log('  noboil stdb <command> [options]\n')
  console.log(bold('Commands:'))
  for (const [name, { description }] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(16)} ${dim(description)}`)
  console.log(`\nRun ${dim('noboil stdb <command> --help')} for command-specific options.\n`)
}
const run = async (argv: string[]): Promise<number> => {
  const [cmd, ...rest] = argv
  if (cmd === '--version' || cmd === '-v') {
    const { getCliVersion } = await import('../shared/version')
    console.log(await getCliVersion())
    return 0
  }
  if (!cmd || cmd === '--help' || cmd === '-h') {
    printHelp()
    return 0
  }
  if (!(cmd in COMMANDS)) {
    console.log(`${red('Unknown command:')} ${cmd}\n`)
    printHelp()
    return 1
  }
  if (cmd === 'add') {
    const { add } = await import('./add')
    await add(rest)
    return 0
  }
  if (cmd === 'use') {
    const { switchTarget } = await import('./use')
    switchTarget(rest)
    return 0
  }
  if (cmd === 'generate') {
    const { generate } = await import('./generate')
    generate(rest)
    return 0
  }
  if (cmd === 'dev') {
    const { dev } = await import('./dev')
    await dev(rest)
    return 0
  }
  const entry = COMMANDS[cmd]
  if (!entry) return 1
  const args = cmd === 'validate' && rest.length === 0 ? ['--health'] : rest
  const script = fileURLToPath(new URL(entry.script, import.meta.url))
  const result = spawnSync('bun', [script, ...args], { stdio: 'inherit' })
  return result.status ?? 1
}
if (import.meta.main) process.exit(await run(process.argv.slice(2)))
export { run }
